import type { TTSProvider } from './types';
import { resolveVoice } from './voices';

type PreparedAudio = { response: Response } | { blob: Blob } | { error: unknown };
type SpeechItem = { text: string; voice: string; rate: number; controller: AbortController; prepared?: Promise<PreparedAudio> };

export class RemoteTTS implements TTSProvider {
  private queue: SpeechItem[] = [];
  private audio?: HTMLAudioElement;
  private active?: AbortController;
  private url?: string;
  private timer?: ReturnType<typeof setTimeout>;
  private idle = () => {};
  private speakingChange = (_speaking: boolean) => {};
  private rate = 1;
  private voice = '';
  private primed = false;
  constructor(private fail: (message: string) => void) {}
  isSupported() { return typeof Audio !== 'undefined'; }
  configure(rate: number, voice: string) { this.rate = rate; this.voice = voice; }
  isIdle() { return !this.active && !this.queue.length; }
  onIdle(cb: () => void) { this.idle = cb; }
  onSpeakingChange(cb: (speaking: boolean) => void) { this.speakingChange = cb; }
  prime() {
    if (!this.isSupported()) return;
    if (this.primed && this.audio?.src) return;
    this.primed = true;
    this.audio ||= new Audio();
    // WAV hening singkat membuka pemutaran dari gesture pengguna.
    const wav = new Uint8Array(204);
    const view = new DataView(wav.buffer);
    for (const [offset, text] of [[0, 'RIFF'], [8, 'WAVEfmt '], [36, 'data']] as const) for (let i = 0; i < text.length; i++) wav[offset + i] = text.charCodeAt(i);
    view.setUint32(4, 196, true); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true); view.setUint32(28, 8000, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true); view.setUint32(40, 160, true); wav.fill(128, 44);
    const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
    this.audio.src = url;
    void this.audio.play().catch(() => {}).finally(() => URL.revokeObjectURL(url));
  }
  speak(text: string, lang: string) {
    this.queue.push({ text, voice: resolveVoice(lang, this.voice), rate: this.rate, controller: new AbortController() });
    void this.next();
    this.prefetch();
  }
  private async prepare(item: SpeechItem, buffered: boolean): Promise<PreparedAudio> {
    try {
      const response = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: item.text, voice: item.voice }), signal: item.controller.signal });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(typeof data?.error === 'string' ? data.error : 'Layanan suara belum bisa menjawab.');
      }
      if (item.controller.signal.aborted) { await response.body?.cancel(); throw new DOMException('Dibatalkan', 'AbortError'); }
      return buffered ? { blob: await response.blob() } : { response };
    } catch (error) { return { error }; }
  }
  private prefetch() {
    const item = this.queue[0];
    if (this.active && item && !item.prepared) {
      // ponytail: hanya satu kalimat di depan; tambah kedalaman jika jeda masih terukur.
      item.prepared = this.prepare(item, true);
    }
  }
  private async next() {
    if (this.active || !this.queue.length) return;
    const item = this.queue.shift()!;
    const controller = item.controller; this.active = controller;
    item.prepared ||= this.prepare(item, false);
    this.prefetch();
    const audio = this.audio ||= new Audio();
    this.timer = setTimeout(() => { if (this.active === controller) this.error('Pemutaran suara terlalu lama. Coba lagi.'); }, 90000);
    try {
      const prepared = await item.prepared;
      if (this.active !== controller) { if ('response' in prepared) await prepared.response.body?.cancel(); return; }
      if ('error' in prepared) throw prepared.error;
      const response = 'response' in prepared ? prepared.response : undefined;
      const streaming = typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/mpeg') && response?.body;
      let pump: (() => Promise<void>) | undefined;
      if (streaming) {
        const source = new MediaSource();
        this.url = URL.createObjectURL(source);
        const opened = new Promise<void>((resolve, reject) => {
          source.addEventListener('sourceopen', () => resolve(), { once: true });
          controller.signal.addEventListener('abort', () => reject(new DOMException('Dibatalkan', 'AbortError')), { once: true });
        });
        audio.src = this.url;
        pump = async () => {
          await opened;
          const buffer = source.addSourceBuffer('audio/mpeg');
          const reader = response!.body!.getReader();
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (this.active !== controller) return;
              if (done) break;
              await new Promise<void>((resolve, reject) => {
                const cleanup = () => { buffer.removeEventListener('updateend', updated); buffer.removeEventListener('error', failed); controller.signal.removeEventListener('abort', failed); };
                const updated = () => { cleanup(); resolve(); };
                const failed = () => { cleanup(); reject(new Error('Stream audio terputus.')); };
                buffer.addEventListener('updateend', updated, { once: true }); buffer.addEventListener('error', failed, { once: true }); controller.signal.addEventListener('abort', failed, { once: true });
                try { buffer.appendBuffer(value as Uint8Array<ArrayBuffer>); } catch (error) { cleanup(); reject(error); }
              });
            }
            if (source.readyState === 'open') source.endOfStream();
          } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
        };
      } else {
        // Browser tanpa MediaSource MP3 menggunakan fallback satu berkas per kalimat.
        const blob = 'blob' in prepared ? prepared.blob : await response!.blob();
        if (this.active !== controller) return;
        if (!blob.size) throw new Error('Audio balasan kosong. Coba lagi.');
        this.url = URL.createObjectURL(blob); audio.src = this.url;
      }
      audio.playbackRate = item.rate;
      audio.onplaying = () => { if (this.active === controller) this.speakingChange(true); };
      audio.onwaiting = () => { if (this.active === controller) this.speakingChange(false); };
      audio.onended = () => {
        if (this.active !== controller) return;
        this.release(); this.active = undefined;
        if (this.queue.length) void this.next(); else this.idle();
      };
      audio.onerror = () => { if (this.active === controller) this.error('Audio balasan gagal diputar. Coba lagi.'); };
      await Promise.all([audio.play(), pump?.()]);
    } catch (error) {
      if (this.active === controller && !controller.signal.aborted) this.error(error instanceof Error && error.name === 'NotAllowedError' ? 'Izinkan pemutaran suara, lalu ketuk mikrofon lagi.' : error instanceof Error ? error.message : 'Suara balasan gagal diputar.');
    }
  }
  private release() {
    clearTimeout(this.timer);
    if (this.audio) { this.audio.onplaying = null; this.audio.onwaiting = null; this.audio.onended = null; this.audio.onerror = null; this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); }
    if (this.url) { URL.revokeObjectURL(this.url); this.url = undefined; }
    this.speakingChange(false);
  }
  private error(message: string) { this.cancel(); this.fail(message); }
  cancel() {
    const active = this.active; this.active = undefined; active?.abort();
    for (const item of this.queue) item.controller.abort();
    this.queue = []; this.release();
  }
}
