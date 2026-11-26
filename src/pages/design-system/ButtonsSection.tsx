import { ArrowRight, Plus, Search } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { ButtonLink } from '../../components/common/ButtonLink';
import { ROUTES } from '../../utils/routes';
import { Section } from './Section';
import styles from './DesignSystemPage.module.css';

export function ButtonsSection() {
  return (
    <Section
      id="buttons"
      title="Buttons"
      description="Primary is for the single most important action on a screen. Secondary and ghost support it. Use ButtonLink when the control navigates somewhere."
    >
      <div className={styles.group}>
        <h3 className={styles.subheading}>Variants</h3>
        <div className={styles.row}>
          <Button variant="primary">Submit claim</Button>
          <Button variant="secondary">Save draft</Button>
          <Button variant="ghost">Cancel</Button>
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.subheading}>Sizes</h3>
        <div className={styles.row}>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.subheading}>With icons</h3>
        <div className={styles.row}>
          <Button leadingIcon={Plus}>Report an item</Button>
          <Button variant="secondary" leadingIcon={Search}>
            Search items
          </Button>
          <Button variant="ghost" trailingIcon={ArrowRight}>
            View details
          </Button>
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.subheading}>States</h3>
        <div className={styles.row}>
          <Button loading>Sending</Button>
          <Button disabled>Unavailable</Button>
          <Button variant="secondary" disabled>
            Unavailable
          </Button>
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.subheading}>Link styled as a button</h3>
        <div className={styles.row}>
          <ButtonLink to={ROUTES.home} variant="secondary" trailingIcon={ArrowRight}>
            Go to home
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}
