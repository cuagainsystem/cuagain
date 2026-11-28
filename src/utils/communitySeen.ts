const KEY = 'cuagain.community.seen';

/** The last time this person looked at the community chat, kept only in this browser. */
export function getCommunitySeen(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function markCommunitySeen(): void {
  try {
    window.localStorage.setItem(KEY, new Date().toISOString());
  } catch {
    // Storage can be blocked. The dot then simply stays until the next visit.
  }
}
