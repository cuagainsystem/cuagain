import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/*
  React Router does not scroll on its own. This jumps to the section named in the URL
  (for example /#faqs), and otherwise returns to the top of the page on every navigation.
*/
export function ScrollToHash() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        target.scrollIntoView();
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);

  return null;
}
