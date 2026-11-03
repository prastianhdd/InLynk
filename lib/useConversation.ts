'use client';

import { useEffect, useRef, useState } from 'react';
import { WebSpeechSTT } from './stt/WebSpeechSTT';
import { RemoteTTS } from './tts/RemoteTTS';
import { StreamParser, type Meta, type ShowPayload } from './parser';
import type { Message, Mode, Phase } from './types';
import type { Emotion } from './emotion';

export type VoiceSettings = { mode: Mode; targetLang: string; rate: number; voiceURI: string };
export function useConversation(settings: VoiceSettings) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [emotion, setEmotion] = useState<Emotion>('neutral');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [toast, setToast] = useState('');
  const [supported, setSupported] = useState<boolean | null>(null);
  const [interim, setInterim] = useState('');
  const [show, setShow] = useState<ShowPayload>({});
  const [suggestion, setSuggestion] = useState<Mode | null>(null);
  const [, setHistory] = useState<Message[]>([]);
  const current = useRef(settings); current.current = settings;
  const history = useRef<Message[]>([]);
  const state = useRef<Phase>('idle');
  const stt = useRef<WebSpeechSTT | null>(null);
  const tts = useRef<RemoteTTS | null>(null);
  const abort = useRef<AbortController | null>(null);
  const turn = useRef(0);
  const streamDone = useRef(true);
  const listenTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const indo = useRef(false);

  function transition(value: Phase) { state.current = value; setPhase(value); }
  function notify(message: string) {
    clearTimeout(toastTimer.current); setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 5000);
  }
  function stop() {
    setIsSpeaking(false);
    turn.current++; abort.current?.abort(); abort.current = null;
    clearTimeout(listenTimer.current); stt.current?.stop(); tts.current?.cancel(); streamDone.current = true;
    transition('idle'); setInterim('');
  }
  function fail(message: string) { stop(); notify(message); }
  function complete() {
    if (streamDone.current && tts.current?.isIdle() && (state.current === 'speaking' || state.current === 'thinking')) transition('idle');
  }
  function saveHistory(messages: Message[]) { history.current = messages.slice(-12); setHistory(history.current); }

  async function submit(text: string) {
    text = text.trim();
    if (!text) return;
    if (text.length > 500) { fail('Ucapan terlalu panjang. Maksimal 500 karakter, coba lebih singkat.'); return; }
    stop();
    tts.current?.prime();
    const id = turn.current;
    const config = { ...current.current };
    const controller = new AbortController(); abort.current = controller;
    const pending: Message[] = [...history.current, { role: 'user' as const, content: text }].slice(-12);
    transition('thinking'); setShow({ user_text: text }); setSuggestion(null);
    streamDone.current = false;
    let spoken = '';
    let meta: Meta = { emotion: 'neutral', mode: config.mode, lang: config.mode === 'chat' ? 'id-ID' : config.targetLang };
    let responseSize = 0;
    const timeout = setTimeout(() => { if (turn.current === id) fail('Balasan terlalu lama. Coba lagi.'); }, 60000);
    const parser = new StreamParser(meta, event => {
      if (turn.current !== id) return;
      if (event.type === 'meta') {
        meta = event.meta; setEmotion(meta.emotion);
        if (meta.mode !== config.mode) setSuggestion(meta.mode);
      } else if (event.type === 'sentence') {
        spoken += (spoken ? ' ' : '') + event.text;
        transition('speaking');
        tts.current?.configure(config.rate, config.voiceURI);
        tts.current?.speak(event.text, meta.lang);
      } else if (event.type === 'show' && config.mode === 'learn') setShow({ user_text: text, ...event.show });
    });
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: config.mode, targetLang: config.targetLang, messages: pending }), signal: controller.signal });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(typeof data?.error === 'string' ? data.error : 'Layanan AI sedang tidak tersedia.');
      }
      if (!response.body) throw new Error('Balasan AI kosong. Coba lagi.');
      const reader = response.body.getReader(); const decoder = new TextDecoder();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (turn.current !== id) { await reader.cancel(); return; }
          if (done) break;
          responseSize += value.length;
          if (responseSize > 64000) throw new Error('Balasan AI terlalu panjang. Coba lagi.');
          parser.push(decoder.decode(value, { stream: true }));
        }
        parser.push(decoder.decode()); parser.finish();
      } finally { reader.releaseLock(); }
      if (turn.current !== id) return;
      if (!spoken) throw new Error('AI belum memberikan ucapan. Coba lagi.');
      saveHistory([...pending, { role: 'assistant', content: spoken.slice(0, 8000) }]);
      streamDone.current = true; abort.current = null; complete();
    } catch (error) {
      if (turn.current === id && !controller.signal.aborted) fail(error instanceof Error ? error.message : 'Koneksi terputus. Coba lagi.');
    } finally { clearTimeout(timeout); }
  }

  function mic(useIndonesian = false) {
    if (state.current === 'listening') { stop(); return; }
    stop();
    tts.current?.prime();
    if (!stt.current?.isSupported() || !tts.current?.isSupported()) { notify('Browser ini belum mendukung percakapan suara. Coba Chrome.'); return; }
    indo.current = useIndonesian;
    transition('listening'); setInterim(''); setShow({});
    listenTimer.current = setTimeout(() => { if (state.current === 'listening') fail('Suara belum terdengar. Ketuk mikrofon untuk mencoba lagi.'); }, 8000);
    stt.current.start({ lang: current.current.mode === 'chat' || indo.current ? 'id-ID' : current.current.targetLang, interim: true });
  }
  function debugSubmit(text: string) { void submit(text); }
  function clear(silent = false) { stop(); saveHistory([]); setShow({}); setSuggestion(null); setEmotion('neutral'); if (!silent) notify('Percakapan dihapus.'); }

  useEffect(() => {
    const speech = new WebSpeechSTT();
    const voice = new RemoteTTS(fail);
    stt.current = speech; tts.current = voice;
    setSupported(speech.isSupported() && voice.isSupported());
    voice.onIdle(complete);
    voice.onSpeakingChange(setIsSpeaking);
    speech.on({
      onInterim: text => { if (state.current === 'listening') setInterim(text); },
      onFinal: text => { if (state.current === 'listening') void submit(text); },
      onError: fail,
      onEnd: () => { if (state.current === 'listening') { clearTimeout(listenTimer.current); transition('idle'); } }
    });
    return () => { turn.current++; abort.current?.abort(); speech.stop(); voice.onSpeakingChange(() => {}); voice.cancel(); clearTimeout(listenTimer.current); clearTimeout(toastTimer.current); };
    // Provider dibuat sekali; callback membaca konfigurasi dan giliran dari ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { phase, emotion, isSpeaking, toast, supported, interim, show, suggestion, mic, stop, clear, debugSubmit };
}
