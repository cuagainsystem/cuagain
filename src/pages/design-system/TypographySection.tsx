import { useCssVariableValue } from '../../hooks/useCssVariableValue';
import { classNames } from '../../utils/classNames';
import { Section } from './Section';
import { TYPE_SAMPLES, type TypeSample } from './tokenData';
import styles from './DesignSystemPage.module.css';

function TypeRow({ sample }: { sample: TypeSample }) {
  const size = useCssVariableValue(sample.variable);

  return (
    <li className={styles.typeRow}>
      <div className={styles.typeMeta}>
        <span className={styles.typeName}>{sample.name}</span>
        <span>{sample.variable}</span>
        <span>{size}</span>
      </div>
      <p
        className={classNames(styles.typeSample, sample.fontFamily === 'display' && styles.typeSampleDisplay)}
        style={{ fontSize: `var(${sample.variable})` }}
      >
        {sample.sample}
      </p>
    </li>
  );
}

export function TypographySection() {
  return (
    <Section
      id="typography"
      title="Typography"
      description="Fraunces, a soft serif, gives headings a calm editorial voice. Manrope handles everything people have to read quickly: forms, labels and body text."
    >
      <ul className={styles.typeList}>
        {TYPE_SAMPLES.map((sample) => (
          <TypeRow key={sample.name} sample={sample} />
        ))}
      </ul>
    </Section>
  );
}
