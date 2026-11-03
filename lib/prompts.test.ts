import { expect, it } from 'vitest';
import { buildSystemPrompt } from './prompts';

function specification(mode: 'chat' | 'learn', lang = 'en-US') {
  return JSON.parse(buildSystemPrompt(mode, lang).split('\n').slice(1).join('\n'));
}

it('Curhat memakai persona mahasiswi fiktif dan mengizinkan campuran Jawa tanpa menjadi pengajar', () => {
  const prompt = specification('chat');
  expect(prompt.mode).toBe('chat');
  expect(prompt.output.metadata.lang).toBe('id-ID');
  expect(prompt.behavior.persona).toContain('perempuan usia 20 tahun');
  expect(prompt.behavior.persona).toContain('jujur bahwa kamu AI');
  expect(prompt.behavior.language).toContain('Jawa ngoko');
  expect(prompt.rules.join(' ')).toContain('Boleh mencampur Bahasa Indonesia dan Jawa');
  expect(prompt.rules).not.toContain('Gunakan satu bahasa ucapan per giliran.');
  expect(prompt.behavior.avoid.join(' ')).toContain('Mengoreksi grammar');
  expect(prompt.behavior.show).toBe('Jangan keluarkan <<SHOW>>.');
});

it('Belajar tetap memakai bahasa target tanpa persona atau campuran Jawa', () => {
  const prompt = specification('learn', 'ja-JP');
  expect(prompt.output.metadata.lang).toBe('ja-JP');
  expect(prompt.behavior.language).toBe('ja-JP');
  expect(prompt.behavior.persona).toBeUndefined();
  expect(prompt.rules).toContain('Gunakan satu bahasa ucapan per giliran.');
  expect(prompt.behavior.show.format).toContain('<<SHOW>>');
});
