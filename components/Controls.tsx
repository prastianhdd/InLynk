import type { Mode, Phase } from '@/lib/types';

export function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return <div className="mode-toggle" role="group" aria-label="Mode percakapan">
    {(['chat', 'learn'] as const).map(value => <button key={value} aria-pressed={mode === value} onClick={() => onChange(value)}>{value === 'chat' ? 'Curhat' : 'Belajar'}</button>)}
  </div>;
}

export function MicButton({ phase, onClick, disabled }: { phase: Phase; onClick: () => void; disabled?: boolean }) {
  const label = phase === 'idle' ? 'Mulai bicara' : phase === 'listening' ? 'Selesai bicara' : 'Interupsi dan mulai bicara';
  return <button className={`mic ${phase}`} aria-label={label} disabled={disabled} onClick={onClick}>
    {phase === 'listening' ? <span aria-hidden="true">≋</span> : phase === 'thinking' || phase === 'speaking' ? <span aria-hidden="true">■</span> : <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg>}
  </button>;
}

export function Toast({ text }: { text: string }) {
  return text ? <div className="toast" role="alert">{text}</div> : null;
}
