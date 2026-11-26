import { Circle, CircleCheck, CircleDot, ListChecks, Palette } from 'lucide-react';
import { ButtonLink } from '../../components/common/ButtonLink';
import { getButtonClassName } from '../../components/common/buttonStyles';
import { ROUTES } from '../../utils/routes';
import { ROADMAP_PHASES, type RoadmapPhase } from './phases';
import styles from './HomePage.module.css';

const PHASE_STATE_ICONS = {
  done: CircleCheck,
  current: CircleDot,
  upcoming: Circle,
} as const;

const PHASE_STATE_LABELS: Record<RoadmapPhase['state'], string> = {
  done: 'Complete',
  current: 'In progress',
  upcoming: 'Upcoming',
};

/*
  Phase 1 placeholder home page. It confirms the layout, routing and design
  system work. Phase 2 replaces it with the real landing page sections.
*/
export function HomePage() {
  const finishedCount = ROADMAP_PHASES.filter((phase) => phase.state === 'done').length;

  return (
    <div className={`container ${styles.hero}`}>
      <section className={styles.copy} aria-labelledby="home-heading">
        <span className="eyebrow">Capitol University lost and found</span>

        <h1 id="home-heading" className={styles.headline}>
          Lost something? <em>Find it again.</em>
        </h1>

        <p className={styles.lead}>
          One place for the school community to report lost belongings, browse found items, and get them back through a
          verified claim process.
        </p>

        <div className={styles.actions}>
          <ButtonLink to={ROUTES.designSystem} size="lg" leadingIcon={Palette}>
            View design system
          </ButtonLink>
          {/* A plain anchor: the router's Link does not scroll to in-page sections. */}
          <a href="#build-status" className={getButtonClassName('secondary', 'lg')}>
            <ListChecks aria-hidden="true" />
            <span>Build status</span>
          </a>
        </div>
      </section>

      <section id="build-status" className={styles.ledger} aria-labelledby="ledger-heading">
        <div className={styles.ledgerHeader}>
          <h2 id="ledger-heading" className={styles.ledgerTitle}>
            Build status
          </h2>
          <p className={styles.ledgerCount}>
            {finishedCount} of {ROADMAP_PHASES.length} phases complete
          </p>
        </div>

        <ol>
          {ROADMAP_PHASES.map((phase) => {
            const StateIcon = PHASE_STATE_ICONS[phase.state];
            const stateLabel = PHASE_STATE_LABELS[phase.state];

            return (
              <li key={phase.number} className={styles.phase} data-state={phase.state}>
                <span className={styles.phaseNumber}>{String(phase.number).padStart(2, '0')}</span>
                <span className={styles.phaseTitle}>{phase.title}</span>
                <span className={styles.phaseGroup}>
                  <StateIcon aria-hidden="true" />
                  {/* Screen readers always hear the state; sighted users see it only for the active phase. */}
                  <span className="visually-hidden">{stateLabel}</span>
                  <span className={styles.phaseLabel} aria-hidden="true">
                    {phase.state === 'upcoming' ? phase.group : stateLabel}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
