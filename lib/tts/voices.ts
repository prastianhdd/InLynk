export const voices: Record<string, { id: string; name: string }[]> = {
  'id-ID': [{ id: 'id-ID-GadisNeural', name: 'Gadis' }],
  'jv-ID': [{ id: 'jv-ID-SitiNeural', name: 'Siti (Jawa)' }],
  'en-US': [{ id: 'en-US-AriaNeural', name: 'Aria' }],
  'ja-JP': [{ id: 'ja-JP-NanamiNeural', name: 'Nanami' }],
  'ko-KR': [{ id: 'ko-KR-SunHiNeural', name: 'SunHi' }],
  'fr-FR': [{ id: 'fr-FR-DeniseNeural', name: 'Denise' }],
  'de-DE': [{ id: 'de-DE-KatjaNeural', name: 'Katja' }],
  'es-ES': [{ id: 'es-ES-ElviraNeural', name: 'Elvira' }]
};
export function resolveVoice(lang: string, voice: string) {
  if (lang === 'id-ID' && voice === 'jv-ID-SitiNeural') return voice;
  const options = voices[lang] || voices['id-ID'];
  return options.find(option => option.id === voice)?.id || options[0].id;
}
