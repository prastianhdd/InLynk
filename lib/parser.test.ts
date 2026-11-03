import { describe, expect, it } from 'vitest';
import { StreamParser, type Meta, type ParserEvent } from './parser';
const meta: Meta = { emotion: 'happy', mode: 'chat', lang: 'id-ID' };
const header = JSON.stringify(meta) + '\n';
function parse(chunks: string[]) {
  const events: ParserEvent[] = [];
  const parser = new StreamParser({ emotion: 'neutral', mode: 'chat', lang: 'id-ID' }, e => events.push(e));
  chunks.forEach(c => parser.push(c)); parser.finish();
  return events;
}
const speech = (events: ParserEvent[]) => events.filter(e => e.type === 'sentence').map(e => e.text);
describe('Protokol suara tidak membocorkan metadata ke TTS', () => {
  it('chat normal mengucapkan tiga kalimat', () => expect(speech(parse([header + 'Halo. Apa kabar? Aku senang!']))).toEqual(['Halo.', 'Apa kabar?', 'Aku senang!']));
  it('menunggu metadata utuh', () => expect(parse([header.slice(0, 12), header.slice(12) + 'Halo.'])[0]).toEqual({ type: 'meta', meta }));
  it('marker lintas chunk tidak ikut diucapkan', () => {
    const events = parse([header + 'Hi.\n<<SH', 'OW>>\n{"translation":"Hai"}']);
    expect(speech(events)).toEqual(['Hi.']); expect(events).toContainEqual({ type: 'show', show: { translation: 'Hai' } });
  });
  it('format menyimpang tetap bisa diucapkan', () => expect(speech(parse(['Bukan JSON\nTetap aman.']))).toEqual(['Bukan JSON', 'Tetap aman.']));
  it('angka desimal tetap utuh', () => expect(speech(parse([header + 'Nilainya 3.5 hari. Selesai.']))).toEqual(['Nilainya 3.5 hari.', 'Selesai.']));
  it('show rusak diabaikan, ucapan tetap selesai', () => expect(parse([header + 'Hi.<<SHOW>>{rusak'])).toEqual([{ type: 'meta', meta }, { type: 'sentence', text: 'Hi.' }, { type: 'done' }]));
  it('sisa tanpa newline tidak hilang', () => expect(speech(parse([header + 'Kalimat terakhir']))).toEqual(['Kalimat terakhir']));
  it('singkatan tidak memecah ucapan', () => expect(speech(parse([header + 'Dr. Budi punya 3.5 apel.']))).toEqual(['Dr. Budi punya 3.5 apel.']));
  it('kalimat keluar sebelum stream selesai', () => {
    const events: ParserEvent[] = []; const p = new StreamParser(meta, e => events.push(e));
    p.push(header + 'Halo. '); expect(speech(events)).toEqual(['Halo.']); expect(events.some(e => e.type === 'done')).toBe(false);
  });
  it('fuzz setiap batas dan ukuran chunk menjaga hasil identik', () => {
    const input = header + 'Dr. Budi menilai 3.5 cukup. Benar?\n<<SHOW>>\n{"translation":"Bagus","vocab":[{"w":"good","m":"baik"}]}';
    const expected = parse([input]);
    for (let i = 0; i <= input.length; i++) expect(parse([input.slice(0, i), input.slice(i)])).toEqual(expected);
    for (let size = 1; size <= 23; size++) expect(parse(Array.from({ length: Math.ceil(input.length / size) }, (_, i) => input.slice(i * size, (i + 1) * size)))).toEqual(expected);
  });
});
