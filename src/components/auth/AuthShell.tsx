import type { ReactNode } from 'react';
import { MailCheck, ShieldCheck, UserRound } from 'lucide-react';
import styles from './AuthShell.module.css';

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Secondary links under the form, such as "New here? Create an account". */
  footer?: ReactNode;
};

/** The shared frame for every sign-in page: a brand panel beside the form. */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.card}>
        <aside className={styles.aside} aria-label="About CUAgain">
          <h2 className={styles.asideTitle}>
            Lost something? <em>Find it again.</em>
          </h2>

          <ul className={styles.assurances}>
            <li className={styles.assurance}>
              <ShieldCheck aria-hidden="true" />
              <span>Your student ID and school email stay private.</span>
            </li>
            <li className={styles.assurance}>
              <MailCheck aria-hidden="true" />
              <span>Every account is verified through a school email address.</span>
            </li>
            <li className={styles.assurance}>
              <UserRound aria-hidden="true" />
              <span>Other users only see your username, avatar and user type.</span>
            </li>
          </ul>
        </aside>

        <div className={styles.panel}>
          <header className={styles.header}>
            <h1 className={styles.title}>{title}</h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </header>

          {children}

          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
