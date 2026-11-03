import { allowRequest } from '@/lib/server-input';
import { voices } from '@/lib/tts/voices';

export const runtime = 'nodejs';
export const maxDuration = 60;
const error = (message: string, status: number) => Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
const allowedVoices = new Set(Object.values(voices).flat().map(voice => voice.id));

export async function POST(request: Request) {
  const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  if (!allowRequest(`tts:${ip}`, 80)) return error('Terlalu banyak permintaan suara. Coba satu menit lagi.', 429);
  if (!request.headers.get('content-type')?.includes('application/json')) return error('Kirim data suara dalam format JSON.', 400);
  let input: string; let voice: string;
  try {
    const reader = request.body?.getReader();
    if (!reader) return error('Permintaan suara kosong.', 400);
    let bytes = 0; let text = ''; const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        bytes += value.length;
        if (bytes > 16000) { await reader.cancel(); return error('Teks suara terlalu panjang.', 400); }
        text += decoder.decode(value, { stream: true });
      }
    } finally { reader.releaseLock(); }
    const data = JSON.parse(text + decoder.decode());
    if (!data || typeof data.input !== 'string' || !data.input.trim() || data.input.length > 3000 || !allowedVoices.has(data.voice)) return error('Teks atau pilihan suara tidak valid.', 400);
    input = data.input.trim(); voice = data.voice;
  } catch { return error('Format permintaan suara tidak valid.', 400); }
  const { LLM_BASE_URL, LLM_API_KEY } = process.env;
  if (!LLM_BASE_URL || !LLM_API_KEY) return error('Layanan suara belum dikonfigurasi.', 503);
  let base: URL;
  try {
    base = new URL(LLM_BASE_URL);
    if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) throw new Error();
  } catch { return error('URL layanan suara tidak valid.', 503); }
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener('abort', abort, { once: true });
  if (request.signal.aborted) abort();
  const timer = setTimeout(abort, 55000);
  let streaming = false;
  try {
    const upstream = await fetch(`${base.toString().replace(/\/$/, '')}/audio/speech`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_API_KEY}` },
      body: JSON.stringify({ model: `edge-tts/${voice}`, input }), signal: controller.signal
    });
    if (!upstream.ok) { await upstream.body?.cancel(); return error('Layanan suara gagal membuat audio. Coba lagi.', upstream.status === 429 ? 429 : 502); }
    const type = upstream.headers.get('content-type') || '';
    if (!/^(audio\/|application\/octet-stream)/i.test(type)) { await upstream.body?.cancel(); return error('Layanan suara tidak mengirim audio MP3.', 502); }
    if (!upstream.body) return error('Audio balasan kosong.', 502);
    const reader = upstream.body.getReader();
    const cleanup = () => { clearTimeout(timer); request.signal.removeEventListener('abort', abort); };
    const stream = new ReadableStream<Uint8Array>({
      async pull(destination) {
        try {
          const { value, done } = await reader.read();
          if (done) { cleanup(); reader.releaseLock(); destination.close(); }
          else destination.enqueue(value);
        } catch { cleanup(); destination.error(new Error('Stream audio terputus.')); }
      },
      async cancel() { abort(); cleanup(); await reader.cancel().catch(() => {}); }
    });
    streaming = true;
    return new Response(stream, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store, no-transform', 'X-Content-Type-Options': 'nosniff', 'X-Accel-Buffering': 'no' } });
  } catch { return error('Koneksi layanan suara terputus atau terlalu lama.', 502); }
  finally { if (!streaming) { clearTimeout(timer); request.signal.removeEventListener('abort', abort); } }
}
