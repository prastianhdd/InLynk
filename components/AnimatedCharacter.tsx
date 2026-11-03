import type { Emotion } from '@/lib/emotion';
import type { Phase } from '@/lib/types';
import styles from './AnimatedCharacter.module.css';

const descriptions: Record<Emotion, string> = {
  neutral: 'ramah', happy: 'senang', laugh: 'tertawa', empathy: 'penuh empati',
  sad: 'sedih', thinking: 'berpikir', surprised: 'terkejut', calm: 'tenang',
};

/** Animation follows playback, not the arrival of streamed sentences. */
export function AnimatedCharacter({ phase, emotion, isSpeaking = false }: {
  phase: Phase; emotion: Emotion; isSpeaking?: boolean;
}) {
  const expression = phase === 'thinking' ? 'thinking' : emotion;
  const activity = isSpeaking ? 'speaking' : phase === 'speaking' ? 'waiting' : phase;
  return <div className={styles.stage} data-phase={activity} data-emotion={expression}>
    <div className={styles.halo} aria-hidden="true" />
    <div className={styles.body} role="img" aria-label={`Karakter InLynk ${descriptions[expression]}${isSpeaking ? ', sedang berbicara' : ''}`}>
      <div className={styles.shine} aria-hidden="true" />
      <div className={styles.face} aria-hidden="true">
        <div className={styles.brows}><b /><b /></div>
        <div className={styles.eyes}><span className={styles.eye}><i /></span><span className={styles.eye}><i /></span></div>
        <span className={`${styles.cheek} ${styles.left}`} /><span className={`${styles.cheek} ${styles.right}`} />
        <div className={styles.mouth} /><span className={styles.tear} />
      </div>
    </div>
    <div className={styles.shadow} aria-hidden="true" />
  </div>;
}
