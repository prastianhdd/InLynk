'use client';
import { useEffect, useState } from 'react';
import { languages, type TargetLang } from './types';
import type { VoiceSettings } from './useConversation';
const defaults: VoiceSettings = { mode: 'chat', targetLang: 'en-US', rate: 1, voiceURI: '' };
export function useSettings() {
  const [settings, setSettings] = useState(defaults);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem('inlynk-settings') || 'null');
      if (value && typeof value === 'object') setSettings({
        mode: value.mode === 'learn' ? 'learn' : 'chat',
        targetLang: typeof value.targetLang === 'string' && Object.hasOwn(languages, value.targetLang) ? value.targetLang as TargetLang : 'en-US',
        rate: typeof value.rate === 'number' && Number.isFinite(value.rate) ? Math.max(0.8, Math.min(1.2, value.rate)) : 1,
        voiceURI: typeof value.voiceURI === 'string' ? value.voiceURI.slice(0, 300) : ''
      });
    } catch { /* Pengaturan tetap bekerja tanpa penyimpanan browser. */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) try { localStorage.setItem('inlynk-settings', JSON.stringify(settings)); } catch {} }, [ready, settings]);
  return { settings, setSettings, ready };
}
