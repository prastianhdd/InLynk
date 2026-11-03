import { isEmotion, type Emotion } from './emotion';
import type { Mode } from './types';

export type Meta = { emotion: Emotion; mode: Mode; lang: string };
export type ShowPayload = { user_text?: string; correction?: string; translation?: string; vocab?: { w: string; m: string }[] };
export type ParserEvent = { type: 'meta'; meta: Meta } | { type: 'sentence'; text: string } | { type: 'show'; show: ShowPayload } | { type: 'done' };
const marker = '<<SHOW>>';
const abbreviations = /(?:\b(?:dr|mr|mrs|ms|prof|dll|dsb|dst|no|vs|etc|e\.g|i\.e)|\b[A-Z])\.$/i;
export const validLang = (value: unknown): value is string => typeof value === 'string' && /^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8}){0,3}$/.test(value);

export class StreamParser {
  private state: 'META' | 'SPEECH' | 'SHOW' = 'META';
  private buffer = '';
  private speech = '';
  private first = true;
  private ended = false;
  constructor(private fallback: Meta, private emit: (event: ParserEvent) => void) {}

  push(chunk: string) {
    if (this.ended) return;
    this.buffer += chunk;
    if (this.state === 'META') {
      const end = this.buffer.indexOf('\n');
      if (end < 0) return;
      this.readMeta(this.buffer.slice(0, end));
      this.buffer = this.buffer.slice(end + 1);
    }
    this.readSpeech(false);
  }

  private readMeta(line: string) {
    let meta = this.fallback;
    try {
      const value: unknown = JSON.parse(line);
      if (!value || typeof value !== 'object') throw new Error();
      const m = value as Record<string, unknown>;
      if (!isEmotion(m.emotion) || (m.mode !== 'chat' && m.mode !== 'learn') || !validLang(m.lang)) throw new Error();
      meta = { emotion: m.emotion, mode: m.mode, lang: m.lang };
    } catch { this.speech += line + '\n'; }
    this.state = 'SPEECH';
    this.emit({ type: 'meta', meta });
  }

  private readSpeech(final: boolean) {
    if (this.state !== 'SPEECH') return;
    const index = this.buffer.indexOf(marker);
    if (index >= 0) {
      this.speech += this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + marker.length);
      this.flush(true);
      this.state = 'SHOW';
      return;
    }
    let held = 0;
    if (!final) for (let n = 1; n < marker.length; n++) if (this.buffer.endsWith(marker.slice(0, n))) held = n;
    this.speech += this.buffer.slice(0, this.buffer.length - held);
    this.buffer = held ? this.buffer.slice(-held) : '';
    this.flush(final);
  }

  private sentence(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.first = false;
    this.emit({ type: 'sentence', text: trimmed });
  }

  private flush(final: boolean) {
    let start = 0;
    for (let i = 0; i < this.speech.length; i++) {
      const char = this.speech[i];
      const next = this.speech[i + 1];
      const part = this.speech.slice(start, i + 1);
      const boundary = next !== undefined ? /\s/.test(next) : final;
      const punctuation = /[.!?…]/.test(char) && boundary && !(char === '.' && abbreviations.test(part));
      const comma = this.first && char === ',' && part.trim().length >= 40 && boundary;
      if (char === '\n' || punctuation || comma) {
        this.sentence(part);
        start = i + 1;
      }
    }
    this.speech = this.speech.slice(start);
    if (final) { this.sentence(this.speech); this.speech = ''; }
  }

  finish() {
    if (this.ended) return;
    if (this.state === 'META') { const line = this.buffer; this.buffer = ''; this.readMeta(line); }
    this.readSpeech(true);
    if (this.state === 'SHOW') {
      try {
        const value: unknown = JSON.parse(this.buffer);
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const raw = value as Record<string, unknown>;
          const show: ShowPayload = {};
          for (const key of ['user_text', 'correction', 'translation'] as const) if (typeof raw[key] === 'string') show[key] = raw[key].slice(0, 2000);
          if (Array.isArray(raw.vocab)) show.vocab = raw.vocab.filter((v): v is { w: string; m: string } => !!v && typeof v === 'object' && typeof v.w === 'string' && typeof v.m === 'string').slice(0, 3).map(v => ({ w: v.w.slice(0, 100), m: v.m.slice(0, 200) }));
          this.emit({ type: 'show', show });
        }
      } catch { /* JSON tambahan yang rusak tidak mengganggu suara. */ }
    }
    this.ended = true;
    this.emit({ type: 'done' });
  }
}
