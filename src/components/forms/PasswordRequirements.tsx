import { Circle, CircleCheck } from 'lucide-react';
import { PASSWORD_RULES } from '../../utils/authSchemas';
import styles from './PasswordRequirements.module.css';

/** Live checklist that ticks off each password rule as the user types. */
export function PasswordRequirements({ password, id }: { password: string; id: string }) {
  return (
    <ul id={id} className={styles.list} aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        const Icon = met ? CircleCheck : Circle;

        return (
          <li key={rule.id} className={styles.rule} data-met={met}>
            <Icon aria-hidden="true" />
            <span>
              {rule.label}
              <span className="visually-hidden">{met ? ' (met)' : ' (not met yet)'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
