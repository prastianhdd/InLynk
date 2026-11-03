import { parseInput, allowRequest } from '@/lib/server-input';
import { buildSystemPrompt } from '@/lib/prompts';
import { textDeltas } from '@/lib/sse';

export const runtime = 'nodejs';
export const maxDuration = 60;
const error = (message: string, status: number) => Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  if (!allowRequest(ip)) return error('Terlalu banyak permintaan. Coba lagi satu menit lagi.', 429);
  if (!request.headers.get('content-type')?.includes('application/json')) return error('Kirim data dalam format JSON.', 400);
  let input;
  try {
    if (Number(request.headers.get('content-length')) > 100000) return error('Permintaan terlalu panjang.', 400);
    const reader = request.body?.getReader();
    if (!reader) return error('Permintaan kosong.', 400);
    const decoder = new TextDecoder(); let text = ''; let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 100000) { await reader.cancel(); return error('Permintaan terlalu panjang.', 400); }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally { reader.releaseLock(); }
    input = parseInput(JSON.parse(text));
  } catch { return error('Format permintaan tidak valid.', 400); }
  if (!input) return error('Data tidak valid. Maksimal 12 pesan; ucapan maksimal 500 karakter.', 400);
  const { LLM_API_KEY, LLM_BASE_URL, LLM_MODEL } = process.env;
  if (!LLM_API_KEY || !LLM_BASE_URL || !LLM_MODEL) return error('Layanan AI belum dikonfigurasi.', 503);
  let base: URL;
  try { base = new URL(LLM_BASE_URL); if (base.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(base.hostname))) throw new Error(); }
  catch { return error('Konfigurasi layanan AI tidak valid.', 503); }
  const abort = new AbortController();
  const cancel = () => abort.abort();
  request.signal.addEventListener('abort', cancel, { once: true });
  if (request.signal.aborted) abort.abort();
  const timer = setTimeout(cancel, 55000);
  const cleanup = () => { clearTimeout(timer); request.signal.removeEventListener('abort', cancel); };
  try {
    const upstream = await fetch(`${base.toString().replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', headers: { Authorization: `Bearer ${LLM_API_KEY}`, 'Content-Type': 'application/json' }, signal: abort.signal,
      body: JSON.stringify({ model: LLM_MODEL, stream: true, temperature: 0.8, max_tokens: 400, messages: [{ role: 'system', content: buildSystemPrompt(input.mode, input.targetLang) }, ...input.messages] })
    });
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel(); cleanup();
      return error(upstream.status === 429 ? 'Penyedia AI sedang sibuk. Coba sebentar lagi.' : 'Layanan AI belum bisa menjawab.', upstream.status === 429 ? 429 : 502);
    }
    const iterator = textDeltas(upstream.body);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await iterator.next();
          if (done) { cleanup(); controller.close(); }
          else controller.enqueue(encoder.encode(value));
        } catch { cleanup(); controller.error(new Error('Koneksi AI terputus.')); }
      },
      async cancel() { cancel(); cleanup(); await iterator.return(undefined).catch(() => {}); }
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Content-Type-Options': 'nosniff', 'X-Accel-Buffering': 'no' } });
  } catch { cleanup(); return error('Tidak dapat terhubung ke AI. Coba lagi.', 502); }
}
