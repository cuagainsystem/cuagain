import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Menu, X } from 'lucide-react';
import { isAdminRole } from '../../types/database';
import { useAuth } from '../../hooks/useAuth';
import { useUnreadCounts } from '../../hooks/useUnreadCounts';
import { CountBadge } from '../communication/CountBadge';
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
  { label: 'My claims', to: ROUTES.myClaims },
  { label: 'Messages', to: ROUTES.messages },
  { label: 'Community', to: ROUTES.community },
];

const ADMIN_ITEMS: NavItem[] = [
  { label: 'Review claims', to: ROUTES.adminClaims },
  { label: 'Abuse reports', to: ROUTES.adminAbuse },
];

const MENU_ID = 'primary-navigation';

export function Navbar() {
  const { user, profile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const counts = useUnreadCounts(user?.id);

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
            {(user ? (isAdminRole(profile?.role) ? [...MEMBER_ITEMS, ...ADMIN_ITEMS] : MEMBER_ITEMS) : NAV_ITEMS).map(({ label, to }) => (
              <li key={to}>
                <Link to={to} className={styles.link} onClick={closeMenu}>
                  {label}
                  {to === ROUTES.messages ? <CountBadge count={counts.messages} label="unread messages" /> : null}
                  {to === ROUTES.community && counts.community ? <span className={styles.newDot} role="img" aria-label="new messages" /> : null}
                </Link>
              </li>
            ))}
            {user ? (
              <li>
                <Link to={ROUTES.notifications} className={styles.link} onClick={closeMenu} aria-label={counts.notifications > 0 ? `Notifications, ${counts.notifications} unread` : 'Notifications'}>
                  <Bell aria-hidden="true" className={styles.bell} />
                  <span className={styles.bellLabel}>Notifications</span>
                  <CountBadge count={counts.notifications} label="unread notifications" />
                </Link>
              </li>
            ) : null}
            <li className={styles.portalItem} onClick={closeMenu}>
              <PortalButton size="sm" />
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
