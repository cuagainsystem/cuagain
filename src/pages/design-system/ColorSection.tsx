import { useCssVariableValue } from '../../hooks/useCssVariableValue';
import { Section } from './Section';
import { COLOR_GROUPS, type ColorToken } from './tokenData';
import styles from './DesignSystemPage.module.css';

function Swatch({ token }: { token: ColorToken }) {
  const value = useCssVariableValue(token.variable);

  return (
    <li className={styles.swatch}>
      <div className={styles.swatchColor} style={{ background: `var(${token.variable})` }} />
      <div className={styles.swatchInfo}>
        <span className={styles.swatchName}>{token.name}</span>
        <span className={styles.swatchValue}>
          {value.toUpperCase()} &middot; {token.variable}
        </span>
        <span className={styles.swatchUsage}>{token.usage}</span>
      </div>
    </li>
  );
}

export function ColorSection() {
  return (
    <Section
      id="color"
      title="Colour"
      description="Capitol red is used sparingly: for the main action, the active state and small accents. Everything else stays white and soft grey so the red carries meaning."
    >
      {COLOR_GROUPS.map((group) => (
        <div key={group.title} className={styles.group}>
          <h3 className={styles.subheading}>{group.title}</h3>
          <ul className={styles.swatchGrid}>
            {group.tokens.map((token) => (
              <Swatch key={token.variable} token={token} />
            ))}
          </ul>
        </div>
      ))}
    </Section>
  );
}
