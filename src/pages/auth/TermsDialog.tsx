import { Button } from '../../components/common/Button';
import { Dialog } from '../../components/common/Dialog';
import styles from '../../components/auth/AuthForm.module.css';

type TermsDialogProps = {
  open: boolean;
  onClose: () => void;
};

/*
  DRAFT TERMS. Written as a starting point for the capstone. Have the school review and
  approve the final wording before the system is opened to real users.
*/
export function TermsDialog({ open, onClose }: TermsDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Terms of use"
      description="Please read these before creating your account."
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className={styles.terms}>
        <p>By creating a CUAgain account you agree to the following.</p>
        <ul>
          <li>Use CUAgain only to report, search for and claim genuine lost or found belongings.</li>
          <li>Give accurate information. False reports or false ownership claims may lead to account suspension.</li>
          <li>Never post personal details of other people, such as ID numbers, in a report or message.</li>
          <li>
            Your student ID and school email are kept private. Other users can only see your username, avatar and user
            type.
          </li>
          <li>
            Administrators review reports and claims, and may remove content or suspend accounts that break these terms.
          </li>
        </ul>
      </div>
    </Dialog>
  );
}
