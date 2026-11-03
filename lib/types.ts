export type Mode = 'chat' | 'learn';
export type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';
export type Message = { role: 'user' | 'assistant'; content: string };
export const languages = { 'en-US': 'Inggris', 'id-ID': 'Indonesia', 'ja-JP': 'Jepang', 'ko-KR': 'Korea', 'fr-FR': 'Prancis', 'de-DE': 'Jerman', 'es-ES': 'Spanyol' };
export type TargetLang = keyof typeof languages;
