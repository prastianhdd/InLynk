import type { TTSProvider } from './types';
export class BrowserTTS implements TTSProvider {
  private queue: { text: string; lang: string }[] = [];
  private active?: SpeechSynthesisUtterance;
  private idle = () => {};
  private speakingChange = (_speaking: boolean) => {};
  private primed = false;
  private warned = false;
  private timer?: ReturnType<typeof setTimeout>;
  private rate = 1;
  private voiceURI = '';
  private voicesWaited = false;
  private stopWaiting?: () => void;
  constructor(private notify: (message: string) => void, private fail: (message: string) => void) {}
  isSupported() { return typeof window !== 'undefined' && 'speechSynthesis' in window; }
  configure(rate: number, voiceURI: string) { this.rate = rate; this.voiceURI = voiceURI; }
  isIdle() { return !this.active && !this.queue.length && !this.stopWaiting; }
  onIdle(cb: () => void) { this.idle = cb; }
  onSpeakingChange(cb: (speaking: boolean) => void) { this.speakingChange = cb; }
  prime() {
    if (this.primed || !this.isSupported()) return;
    this.primed = true;
    const utterance = new SpeechSynthesisUtterance('');
    window.speechSynthesis.speak(utterance);
  }
  speak(text: string, lang: string) { this.queue.push({ text, lang }); this.next(); }
  private next() {
    if (this.active || this.stopWaiting || !this.queue.length) return;
    if (!this.isSupported()) { this.cancel(); this.fail('Browser ini belum mendukung suara balasan. Coba Chrome.'); return; }
    if (!window.speechSynthesis.getVoices().length && !this.voicesWaited) {
      this.voicesWaited = true;
      const resume = () => { this.stopWaiting?.(); this.stopWaiting = undefined; this.next(); };
      const timeout = setTimeout(resume, 1000);
      window.speechSynthesis.addEventListener('voiceschanged', resume, { once: true });
      this.stopWaiting = () => { clearTimeout(timeout); window.speechSynthesis.removeEventListener('voiceschanged', resume); };
      return;
    }
    const item = this.queue.shift()!;
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.lang = item.lang; utterance.rate = this.rate;
    const voices = window.speechSynthesis.getVoices();
    const matching = voices.filter(v => v.lang.toLowerCase().split('-')[0] === item.lang.toLowerCase().split('-')[0]);
    const voice = matching.find(v => v.voiceURI === this.voiceURI) || matching.find(v => v.lang.toLowerCase() === item.lang.toLowerCase()) || matching[0];
    if (voice) utterance.voice = voice;
    else if (!this.warned) { this.warned = true; this.notify('Suara bahasa ini belum tersedia. Menggunakan suara bawaan.'); }
    this.active = utterance;
    utterance.onstart = () => { if (this.active === utterance) this.speakingChange(true); };
    utterance.onpause = () => { if (this.active === utterance) this.speakingChange(false); };
    utterance.onresume = () => { if (this.active === utterance) this.speakingChange(true); };
    utterance.onend = () => {
      if (this.active !== utterance) return;
      clearTimeout(this.timer); this.active = undefined;
      this.speakingChange(false);
      if (this.queue.length) this.next(); else this.idle();
    };
    utterance.onerror = () => { if (this.active === utterance) { this.cancel(); this.fail('Suara balasan gagal diputar. Ketuk mikrofon untuk mencoba lagi.'); } };
    this.timer = setTimeout(() => { if (this.active === utterance) { this.cancel(); this.fail('Pemutaran suara terlalu lama. Coba lagi.'); } }, Math.max(20000, Math.min(90000, item.text.length * 160)));
    try { window.speechSynthesis.speak(utterance); } catch { this.cancel(); this.fail('Suara balasan belum bisa diputar.'); }
  }
  cancel() {
    this.speakingChange(false);
    clearTimeout(this.timer); this.stopWaiting?.(); this.stopWaiting = undefined; this.queue = [];
    if (this.active) {
      this.active.onstart = null; this.active.onpause = null; this.active.onresume = null;
      this.active.onend = null; this.active.onerror = null; this.active = undefined;
    }
    if (this.isSupported()) window.speechSynthesis.cancel();
  }
}
