import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Dialog } from '../../components/common/Dialog';
import { Section } from './Section';
import styles from './DesignSystemPage.module.css';

export function DialogSection() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Section
      id="dialog"
      title="Dialog"
      description="Built on the native dialog element, so focus stays inside, Escape closes it, and clicking the backdrop dismisses it."
    >
      <div className={styles.row}>
        <Button variant="secondary" leadingIcon={MessageSquare} onClick={() => setDialogOpen(true)}>
          Open dialog
        </Button>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Confirm handover"
        description="Only an administrator can mark an item as handed over."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setDialogOpen(false)}>Confirm</Button>
          </>
        }
      >
        <p>
          Confirm that the owner presented proof and collected the item at the designated office. This closes the claim
          and removes the item from the open listings.
        </p>
      </Dialog>
    </Section>
  );
}
