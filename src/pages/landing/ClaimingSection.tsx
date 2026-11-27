import { LockKeyhole } from 'lucide-react';
import styles from './Landing.module.css';

const CLAIM_STEPS = [
  {
    title: 'Find the listing',
    text: 'Search the found items and open the one that looks like yours.',
  },
  {
    title: 'Submit your claim',
    text: 'Explain why it is yours. Mention details that are not visible in the listing, and add proof if you can.',
  },
  {
    title: 'Wait for the review',
    text: 'An administrator compares your claim with the report. You are notified when there is a decision.',
  },
  {
    title: 'Collect your item',
    text: 'If approved, you will be told where and how to collect it. Bring your school ID.',
  },
];

export function ClaimingSection() {
  return (
    <section id="claiming" className={`container ${styles.section}`} aria-labelledby="claiming-heading">
      <div className={styles.claiming}>
        <div className={styles.header}>
          <span className="eyebrow">Claiming an item</span>
          <h2 id="claiming-heading" className={styles.heading}>
            Prove it is yours, <em>then take it home.</em>
          </h2>
          <p className={styles.lead}>
            Every item is handed over only after a claim is reviewed. That protects owners from impostors and keeps
            found items safe.
          </p>
        </div>

        <div>
          <ol className={styles.claimSteps}>
            {CLAIM_STEPS.map(({ title, text }) => (
              <li key={title} className={styles.claimStep}>
                <div>
                  <h3 className={styles.claimStepTitle}>{title}</h3>
                  <p className={styles.claimStepText}>{text}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className={styles.callout}>
            <LockKeyhole aria-hidden="true" />
            <p>Your claim details and any evidence you upload are visible only to you and the administrators.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
