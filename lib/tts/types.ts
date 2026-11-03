export interface TTSProvider {
  isSupported(): boolean;
  prime(): void;
  speak(text: string, lang: string): void;
  cancel(): void;
  onIdle(cb: () => void): void;
  onSpeakingChange(cb: (speaking: boolean) => void): void;
}
