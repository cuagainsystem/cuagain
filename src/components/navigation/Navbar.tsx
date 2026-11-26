import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { House, Menu, Palette, X, type LucideIcon } from 'lucide-react';
import { ROUTES } from '../../utils/routes';
import { LogoPlaceholder } from '../common/LogoPlaceholder';
import styles from './Navbar.module.css';

type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

// Phase 2 adds the Student Web Portal button next to these links.
const NAV_ITEMS: NavItem[] = [
  { label: 'Home', to: ROUTES.home, icon: House },
  { label: 'Design system', to: ROUTES.designSystem, icon: Palette },
];

const MENU_ID = 'primary-navigation';

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={styles.navbar}>
      <div className={`container ${styles.inner}`}>
        <Link to={ROUTES.home} className={styles.brand} aria-label="CUAgain home">
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
            {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
              <li key={to}>
                <NavLink to={to} end className={styles.link} onClick={() => setMenuOpen(false)}>
                  <Icon aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
