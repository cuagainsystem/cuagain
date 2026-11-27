import { Circle, CircleCheck, CircleDot } from 'lucide-react';
import { ROADMAP_PHASES, type RoadmapPhase } from '../landing/phases';
import { Section } from './Section';
import styles from './BuildStatusSection.module.css';

const STATE_ICONS = { done: CircleCheck, current: CircleDot, upcoming: Circle } as const;
const STATE_LABELS: Record<RoadmapPhase['state'], string> = {
  done: 'Complete',
  current: 'In progress',
  upcoming: 'Upcoming',
};

/** A developer-facing view of roadmap progress. Edit landing/phases.ts to update it. */
export function BuildStatusSection() {
  const doneCount = ROADMAP_PHASES.filter((phase) => phase.state === 'done').length;

  return (
    <Section
      id="build-status"
      title="Build status"
      description={`${doneCount} of ${ROADMAP_PHASES.length} roadmap phases complete. Essential phases come first, as the roadmap recommends.`}
    >
      <ol className={styles.list}>
        {ROADMAP_PHASES.map((phase) => {
          const StateIcon = STATE_ICONS[phase.state];

          return (
            <li key={phase.number} className={styles.phase} data-state={phase.state}>
              <span className={styles.number}>{String(phase.number).padStart(2, '0')}</span>
              <span className={styles.title}>{phase.title}</span>
              <span className={styles.state}>
                <StateIcon aria-hidden="true" />
                {phase.state === 'upcoming' ? phase.group : STATE_LABELS[phase.state]}
              </span>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
