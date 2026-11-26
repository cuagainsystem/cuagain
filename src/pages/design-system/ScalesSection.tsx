import { useCssVariableValue } from '../../hooks/useCssVariableValue';
import { classNames } from '../../utils/classNames';
import { Section } from './Section';
import { ELEVATION_TOKENS, RADIUS_TOKENS, SPACING_TOKENS, type ScaleToken } from './tokenData';
import styles from './DesignSystemPage.module.css';

function ScaleLabel({ token }: { token: ScaleToken }) {
  const value = useCssVariableValue(token.variable);

  return (
    <div>
      <strong>{token.name}</strong>
      <span className={styles.scaleValue}>{token.variable}</span>
      {/* Shadows are long; show the value only for the shorter tokens. */}
      {value.length <= 24 ? <span className={styles.scaleValue}>{value}</span> : null}
    </div>
  );
}

export function ScalesSection() {
  return (
    <Section
      id="spacing"
      title="Spacing, radius and elevation"
      description="A 4px spacing scale, generous corner radii, and a soft raised and inset shadow pair that gives surfaces a gentle, tactile feel without heavy effects."
    >
      <div className={styles.group}>
        <h3 className={styles.subheading}>Spacing</h3>
        <ul className={styles.scaleList}>
          {SPACING_TOKENS.map((token) => (
            <li key={token.variable} className={styles.scaleRow}>
              <ScaleLabel token={token} />
              <div className={styles.spaceBar} style={{ width: `var(${token.variable})` }} />
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.group}>
        <h3 className={styles.subheading}>Radius</h3>
        <ul className={styles.tileGrid}>
          {RADIUS_TOKENS.map((token) => (
            <li
              key={token.variable}
              className={classNames(styles.tile, styles.tileRadius)}
              style={{ borderRadius: `var(${token.variable})` }}
            >
              {token.name}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.group}>
        <h3 className={styles.subheading}>Elevation</h3>
        <ul className={styles.tileGrid}>
          {ELEVATION_TOKENS.map((token) => (
            <li
              key={token.variable}
              className={styles.tile}
              style={{ borderRadius: 'var(--radius-lg)', boxShadow: `var(${token.variable})` }}
            >
              {token.name}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
