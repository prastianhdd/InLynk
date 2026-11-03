import type { STTHandlers, STTProvider } from './types';
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((event: { resultIndex: number; results: { length: number; [index: number]: { isFinal: boolean; [index: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
const constructor = () => typeof window === 'undefined' ? undefined : (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
export class WebSpeechSTT implements STTProvider {
  private recognition?: Recognition;
  private handlers?: STTHandlers;
  isSupported() { return !!constructor(); }
  on(handlers: STTHandlers) { this.handlers = handlers; }
  start(opts: { lang: string; interim?: boolean }) {
    this.stop();
    const Constructor = constructor();
    if (!Constructor) { this.handlers?.onError('Browser ini belum mendukung input suara. Coba Chrome.'); return; }
    const recognition = new Constructor(); this.recognition = recognition;
    recognition.lang = opts.lang; recognition.interimResults = opts.interim ?? true; recognition.continuous = false;
    recognition.onresult = event => {
      if (this.recognition !== recognition) return;
      let interim = ''; let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript; else interim += result[0].transcript;
      }
      if (interim) this.handlers?.onInterim?.(interim);
      if (final.trim()) this.handlers?.onFinal(final.trim());
    };
    recognition.onerror = event => {
      if (this.recognition !== recognition || event.error === 'aborted') return;
      const messages: Record<string, string> = { 'not-allowed': 'Izinkan mikrofon untuk mulai bicara.', 'service-not-allowed': 'Pengenalan suara tidak diizinkan browser.', 'audio-capture': 'Mikrofon tidak ditemukan.', network: 'Pengenalan suara membutuhkan koneksi internet.', 'no-speech': 'Suara belum terdengar. Coba lagi.' };
      this.handlers?.onError(messages[event.error] || 'Pengenalan suara gagal. Coba lagi.');
    };
    recognition.onend = () => { if (this.recognition === recognition) { this.recognition = undefined; this.handlers?.onEnd(); } };
    try { recognition.start(); } catch { this.stop(); this.handlers?.onError('Mikrofon belum bisa dimulai. Coba lagi.'); }
  }
  stop() {
    const recognition = this.recognition; this.recognition = undefined;
    if (recognition) { recognition.onresult = null; recognition.onerror = null; recognition.onend = null; try { recognition.abort(); } catch {} }
  }
}
