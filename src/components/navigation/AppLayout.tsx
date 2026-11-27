import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { PageLoader } from '../common/PageLoader';
import { Footer } from './Footer';
import { Navbar } from './Navbar';
import { ScrollToHash } from './ScrollToHash';
import styles from './AppLayout.module.css';

/** The shared page frame: skip link, navigation, page content, footer. */
export function AppLayout() {
  return (
    <div className={styles.shell}>
      <ScrollToHash />
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" className={styles.main} tabIndex={-1}>
        {/* Shows a spinner in the content area while a lazy-loaded page downloads. */}
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
