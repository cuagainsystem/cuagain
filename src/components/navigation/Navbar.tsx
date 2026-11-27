import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { HOME_SECTIONS, ROUTES } from '../../utils/routes';
import { LogoPlaceholder } from '../common/LogoPlaceholder';
import { PortalButton } from '../common/PortalButton';
import styles from './Navbar.module.css';

type NavItem = {
  label: string;
  to: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'How it works', to: HOME_SECTIONS.howItWorks },
  { label: 'Guidelines', to: HOME_SECTIONS.guidelines },
  { label: 'Claiming', to: HOME_SECTIONS.claiming },
  { label: 'FAQs', to: HOME_SECTIONS.faqs },
];

/** Signed-in users get their working links. The landing page sections stay reachable from the footer. */
const MEMBER_ITEMS: NavItem[] = [
  { label: 'Browse', to: ROUTES.reports },
  { label: 'My reports', to: ROUTES.myReports },
];

const MENU_ID = 'primary-navigation';

export function Navbar() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={styles.navbar}>
      <div className={`container ${styles.inner}`}>
        <Link to={ROUTES.home} className={styles.brand} aria-label="CUAgain home" onClick={closeMenu}>
          <LogoPlaceholder size="md" />
        </Link>

        <button
          type="button"
          className={styles.menuButton}
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls={MENU_ID}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>

        <nav aria-label="Primary">
          <ul id={MENU_ID} className={styles.links} data-open={menuOpen}>
            {(user ? MEMBER_ITEMS : NAV_ITEMS).map(({ label, to }) => (
              <li key={to}>
                <Link to={to} className={styles.link} onClick={closeMenu}>
                  {label}
                </Link>
              </li>
            ))}
            <li className={styles.portalItem} onClick={closeMenu}>
              <PortalButton size="sm" />
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
