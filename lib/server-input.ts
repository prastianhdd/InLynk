import { validLang } from './parser';
import type { Message, Mode } from './types';
export type ChatInput = { mode: Mode; targetLang: string; messages: Message[] };
export function parseInput(value: unknown): ChatInput | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if ((v.mode !== 'chat' && v.mode !== 'learn') || !validLang(v.targetLang) || !Array.isArray(v.messages) || !v.messages.length || v.messages.length > 12) return null;
  const messages: Message[] = [];
  for (const message of v.messages) {
    if (!message || typeof message !== 'object') return null;
    const m = message as Record<string, unknown>;
    if ((m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim() || m.content.length > (m.role === 'user' ? 500 : 8000)) return null;
    messages.push({ role: m.role, content: m.content });
  }
  if (messages.at(-1)?.role !== 'user') return null;
  return { mode: v.mode, targetLang: v.targetLang, messages: messages.slice(-12) };
}

const limits = new Map<string, { count: number; until: number }>();
export function allowRequest(ip: string, maximum = 20): boolean {
  const now = Date.now();
  for (const [key, value] of limits) if (value.until <= now) limits.delete(key);
  const current = limits.get(ip);
  if (current) return ++current.count <= maximum;
  if (limits.size >= 10000) return false;
  limits.set(ip, { count: 1, until: now + 60000 });
  return true;
}
