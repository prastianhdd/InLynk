'use client';
import { useEffect, useRef, useState } from 'react';
import { languages } from '@/lib/types';
import type { VoiceSettings } from '@/lib/useConversation';
export function SettingsSheet({ open, onClose, settings, onChange, onClear }: { open: boolean; onClose: () => void; settings: VoiceSettings; onChange: (value: VoiceSettings) => void; onClear: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const update = () => setVoices(window.speechSynthesis.getVoices());
    update(); window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);
  useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); else if (!open && dialog.current?.open) dialog.current.close(); }, [open]);
  const lang = settings.mode === 'chat' ? 'id-ID' : settings.targetLang;
  const filtered = voices.filter(v => v.lang.toLowerCase().split('-')[0] === lang.toLowerCase().split('-')[0]);
  return <dialog ref={dialog} aria-labelledby="settings-title" onCancel={onClose} onClose={onClose}>
    <div className="sheet-heading"><h2 id="settings-title">Buat nyamanmu</h2><button className="icon-button" aria-label="Tutup pengaturan" onClick={onClose}>×</button></div>
    <label className="field">Bahasa belajar<select value={settings.targetLang} onChange={e => onChange({ ...settings, targetLang: e.target.value, voiceURI: '' })}>{Object.entries(languages).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
    <label className="field">Kecepatan bicara: {settings.rate.toFixed(1)}×<input type="range" min="0.8" max="1.2" step="0.1" value={settings.rate} onChange={e => onChange({ ...settings, rate: Number(e.target.value) })}/></label>
    <label className="field">Suara balasan<select value={filtered.some(v => v.voiceURI === settings.voiceURI) ? settings.voiceURI : ''} onChange={e => onChange({ ...settings, voiceURI: e.target.value })}><option value="">Otomatis</option>{filtered.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}</select></label>
    <p className="privacy">Percakapan hanya berada di memori sesi ini. Audio tidak direkam atau disimpan oleh aplikasi. Ucapan diproses layanan pengenalan suara browser; teks dikirim ke penyedia AI. Pengaturan disimpan di perangkat.</p>
    <button className="danger" onClick={() => { if (window.confirm('Hapus percakapan sesi ini? Tindakan ini tidak dapat dibatalkan.')) { onClear(); onClose(); } }}>Hapus percakapan</button>
  </dialog>;
}
