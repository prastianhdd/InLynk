export const emotions = { neutral: '🙂', happy: '😄', laugh: '😂', empathy: '🥹', sad: '😢', thinking: '🤔', surprised: '😮', calm: '😌' } as const;
export type Emotion = keyof typeof emotions;
export function isEmotion(value: unknown): value is Emotion {
  return typeof value === 'string' && Object.hasOwn(emotions, value);
}
