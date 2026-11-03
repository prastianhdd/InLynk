'use client';

import { useEffect, useState } from 'react';
import { AnimatedCharacter } from '@/components/AnimatedCharacter';
import { MicButton, ModeToggle, Toast } from '@/components/Controls';
import { LearnPanel } from '@/components/LearnPanel';
import type { Mode } from '@/lib/types';
import { SettingsSheet } from '@/components/SettingsSheet';
import { useConversation } from '@/lib/useConversation';
import { useSettings } from '@/lib/useSettings';

export default function Home() {
  const { settings, setSettings, ready } = useSettings();
  const conversation = useConversation(settings);
  const [sheet, setSheet] = useState(false);
  const [indonesian, setIndonesian] = useState(false);
  const [debug, setDebug] = useState(false);
  const [text, setText] = useState('');
  useEffect(() => { setDebug(new URLSearchParams(window.location.search).get('debug') === '1'); }, []);
  function changeMode(mode: Mode) {
    if (mode === settings.mode) return;
    conversation.clear(true);
    setSettings({ ...settings, mode, voiceURI: '' });
    setIndonesian(false);
  }
  const status = { idle: 'Ketuk mikrofon untuk mulai', listening: 'Mendengarkan…', thinking: 'Berpikir…', speaking: 'Sedang menemani kamu…' };
  return <div className="app" data-mode={settings.mode}>
    <header><div className="brand">InLynk<small>TEMAN BICARA</small></div><ModeToggle mode={settings.mode} onChange={changeMode}/><button className="icon-button" aria-label="Buka pengaturan" onClick={() => { conversation.stop(); setSheet(true); }}>⚙</button></header>
    <main>
      {conversation.supported === false ? <p className="unsupported">Browser ini belum mendukung percakapan suara. Coba Chrome. Aktifkan izin mikrofon melalui koneksi HTTPS.</p> : <AnimatedCharacter phase={conversation.phase} emotion={conversation.emotion} isSpeaking={conversation.isSpeaking}/>}
      {settings.mode === 'learn' && <LearnPanel show={conversation.show} interim={conversation.interim}/>}
      {conversation.suggestion && <button className="text-button suggestion" onClick={() => changeMode(conversation.suggestion!)}>Mau pindah ke mode {conversation.suggestion === 'learn' ? 'Belajar' : 'Curhat'}?</button>}
    </main>
    <footer>
      {settings.mode === 'learn' && <button className="text-button" aria-pressed={indonesian} onClick={() => { conversation.stop(); setIndonesian(!indonesian); }}>{indonesian ? 'Kembali bicara bahasa target' : 'Bicara Indonesia'}</button>}
      <p className="status" role="status" aria-live="polite">{status[conversation.phase]}</p>
      <MicButton phase={conversation.phase} disabled={!ready || !conversation.supported || sheet} onClick={() => conversation.mic(indonesian)}/>
      <p className="hint">Ketuk, bicara, rasakan didengar.</p>
      {debug && <form className="debug" onSubmit={e => { e.preventDefault(); conversation.debugSubmit(text); setText(''); }}><input type="text" aria-label="Ucapan pengujian" placeholder="Ucapan pengujian" maxLength={500} value={text} onChange={e => setText(e.target.value)}/><button type="submit" disabled={!text.trim()}>Kirim</button></form>}
    </footer>
    <SettingsSheet open={sheet} onClose={() => setSheet(false)} settings={settings} onChange={value => { conversation.stop(); setSettings(value); }} onClear={conversation.clear}/>
    <Toast text={conversation.toast}/>
  </div>;
}
