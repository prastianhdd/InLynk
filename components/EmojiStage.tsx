import type { Phase } from '@/lib/types';

export function EmojiStage({ emoji, phase }: { emoji: string; phase: Phase }) {
  return <div className={`emoji-stage ${phase}`}><span key={emoji} className="emoji" role="img" aria-label="Ekspresi teman">{phase === 'thinking' ? '🤔' : emoji}</span></div>;
}
