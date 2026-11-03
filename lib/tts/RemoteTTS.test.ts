import { afterEach, expect, it, vi } from 'vitest';
import { RemoteTTS } from './RemoteTTS';
import { resolveVoice } from './voices';

it('Gadis tetap default; Siti dapat dipilih untuk Curhat tanpa mengubah suara bahasa lain', () => {
  expect(resolveVoice('id-ID', '')).toBe('id-ID-GadisNeural');
  expect(resolveVoice('id-ID', 'id-ID-ArdiNeural')).toBe('id-ID-GadisNeural');
  expect(resolveVoice('id-ID', 'jv-ID-SitiNeural')).toBe('jv-ID-SitiNeural');
  expect(resolveVoice('en-US', 'jv-ID-SitiNeural')).toBe('en-US-AriaNeural');
  expect(resolveVoice('en-US', '')).toBe('en-US-AriaNeural');
});
class FakeAudio {
  src = ''; playbackRate = 1;
  onplaying: (() => void) | null = null;
  onwaiting: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn(async () => { this.onplaying?.(); });
  pause = vi.fn(); load() {} removeAttribute() {}
  constructor() { audio = this; }
}
let audio: FakeAudio;
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('MP3 diputar berurutan; interupsi membatalkan fetch dan tidak memutar balasan terlambat', async () => {
  vi.stubGlobal('Audio', FakeAudio);
  const fetcher = vi.fn().mockImplementation(async () => new Response(new Blob(['mp3'], { type: 'audio/mpeg' })));
  vi.stubGlobal('fetch', fetcher);
  const fail = vi.fn(); const idle = vi.fn(); const tts = new RemoteTTS(fail);
  tts.onIdle(idle); tts.configure(1.1, '');
  tts.speak('Halo.', 'id-ID'); tts.speak('Apa kabar?', 'id-ID'); tts.speak('Aku mendengarkan.', 'id-ID');
  await vi.waitFor(() => expect(audio.play).toHaveBeenCalledTimes(1));
  // Kalimat kedua sudah diminta sebelum audio pertama selesai, ketiga belum.
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetcher.mock.calls[0][1].body).voice).toBe('id-ID-GadisNeural');
  expect(audio.playbackRate).toBe(1.1);
  audio.onended?.();
  await vi.waitFor(() => expect(audio.play).toHaveBeenCalledTimes(2));
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(JSON.parse(fetcher.mock.calls[1][1].body).input).toBe('Apa kabar?');
  expect(JSON.parse(fetcher.mock.calls[2][1].body).input).toBe('Aku mendengarkan.');
  audio.onended?.();
  await vi.waitFor(() => expect(audio.play).toHaveBeenCalledTimes(3));
  audio.onended?.(); expect(idle).toHaveBeenCalledOnce();
  let resolve!: (response: Response) => void;
  fetcher.mockImplementationOnce(() => new Promise<Response>(r => { resolve = r; }));
  tts.speak('Dibatalkan.', 'id-ID');
  tts.speak('Prefetch dibatalkan juga.', 'id-ID');
  const signal = fetcher.mock.calls[3][1].signal as AbortSignal;
  const prefetchSignal = fetcher.mock.calls[4][1].signal as AbortSignal;
  tts.cancel(); expect(signal.aborted).toBe(true); expect(prefetchSignal.aborted).toBe(true); expect(tts.isIdle()).toBe(true);
  resolve(new Response(new Blob(['late'])));
  await new Promise(r => setTimeout(r, 0));
  expect(audio.play).toHaveBeenCalledTimes(3); expect(fail).not.toHaveBeenCalled();
});
