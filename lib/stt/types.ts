export type STTHandlers = { onInterim?: (text: string) => void; onFinal: (text: string) => void; onError: (error: string) => void; onEnd: () => void };
export interface STTProvider {
  isSupported(): boolean;
  start(opts: { lang: string; interim?: boolean }): void;
  stop(): void;
  on(handlers: STTHandlers): void;
}
