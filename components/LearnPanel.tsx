import type { ShowPayload } from '@/lib/parser';
export function LearnPanel({ show, interim }: { show: ShowPayload; interim: string }) {
  return <section className="learn-panel" aria-label="Catatan belajar" aria-live="polite">
    <h2>Ucapan kamu</h2><p>{interim || show.user_text || 'Ketuk mikrofon, lalu coba bicara.'}</p>
    {show.correction && <><h2>Sedikit koreksi</h2><p>{show.correction}</p></>}
    {show.translation && <><h2>Arti balasan</h2><p>{show.translation}</p></>}
    {!!show.vocab?.length && <><h2>Kosakata</h2><div className="vocab">{show.vocab.map((item, i) => <span key={i}><strong>{item.w}</strong> · {item.m}</span>)}</div></>}
  </section>;
}
