import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserTTS } from './BrowserTTS';

class Utterance {
  lang = ''; rate = 1; voice = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onresume: (() => void) | null = null;
  constructor(public text: string) {}
}

describe('BrowserTTS playback animation signals', () => {
  let played: Utterance[];
  let provider: BrowserTTS;
  let activity: ReturnType<typeof vi.fn<(speaking: boolean) => void>>;
  let failed: ReturnType<typeof vi.fn<(message: string) => void>>;
  let voices: { lang: string; voiceURI: string }[];
  beforeEach(() => {
    vi.useFakeTimers(); played = []; activity = vi.fn(); failed = vi.fn();
    voices = [{ lang: 'id-ID', voiceURI: 'id' }];
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
    vi.stubGlobal('window', { speechSynthesis: {
      getVoices: () => voices,
      speak: (utterance: Utterance) => played.push(utterance),
      cancel: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(),
    } });
    provider = new BrowserTTS(vi.fn(), failed);
    provider.onSpeakingChange(activity);
  });
  afterEach(() => { provider.cancel(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('keeps mouth still until actual playback, including between queued sentences', () => {
    const idle = vi.fn(); provider.onIdle(idle);
    provider.speak('Halo.', 'id-ID'); provider.speak('Apa kabar?', 'id-ID');
    expect(activity).not.toHaveBeenCalled();
    played[0].onstart?.(); expect(activity).toHaveBeenLastCalledWith(true);
    played[0].onend?.(); expect(activity).toHaveBeenLastCalledWith(false);
    expect(played).toHaveLength(2); expect(idle).not.toHaveBeenCalled();
    played[1].onstart?.(); expect(activity).toHaveBeenLastCalledWith(true);
    played[1].onend?.(); expect(activity).toHaveBeenLastCalledWith(false);
    expect(idle).toHaveBeenCalledOnce(); expect(provider.isIdle()).toBe(true);
  });
  it('stops mouth on interrupt and ignores callbacks from cancelled speech', () => {
    provider.speak('Kalimat lama.', 'id-ID');
    const lateStart = played[0].onstart; const lateEnd = played[0].onend;
    played[0].onstart?.(); provider.cancel();
    expect(activity).toHaveBeenLastCalledWith(false);
    activity.mockClear(); lateStart?.(); lateEnd?.();
    expect(activity).not.toHaveBeenCalled(); expect(provider.isIdle()).toBe(true);
  });
  it('stops during pause and resumes with playback', () => {
    provider.speak('Halo.', 'id-ID'); played[0].onstart?.();
    played[0].onpause?.(); expect(activity).toHaveBeenLastCalledWith(false);
    played[0].onresume?.(); expect(activity).toHaveBeenLastCalledWith(true);
  });
  it('stops mouth and clears queue on playback error', () => {
    provider.speak('Halo.', 'id-ID'); played[0].onstart?.(); played[0].onerror?.();
    expect(activity).toHaveBeenLastCalledWith(false);
    expect(failed).toHaveBeenCalledOnce(); expect(provider.isIdle()).toBe(true);
  });
  it('does not animate the silent priming utterance or while waiting for voices', () => {
    provider.prime(); played[0].onstart?.(); expect(activity).not.toHaveBeenCalled();
    voices = []; provider.speak('Halo.', 'id-ID');
    expect(played).toHaveLength(1); expect(activity).not.toHaveBeenCalled();
    provider.cancel(); vi.advanceTimersByTime(1100);
    expect(played).toHaveLength(1); expect(provider.isIdle()).toBe(true);
  });
});
