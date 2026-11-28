import { useEffect, useState } from 'react';
import { getLatestCommunityActivity } from '../services/communityService';
import { countUnreadMessages } from '../services/messageService';
import { countUnreadNotifications } from '../services/notificationService';
import { subscribeToTable } from '../services/realtime';
import { getCommunitySeen } from '../utils/communitySeen';

export const COUNTS_EVENT = 'cuagain:refresh-counts';

/** Screens call this after they change what counts as unread, so the navigation updates at once. */
export function refreshUnreadCounts(): void {
  window.dispatchEvent(new Event(COUNTS_EVENT));
}

export type UnreadCounts = { notifications: number; messages: number; community: boolean };

const NONE: UnreadCounts = { notifications: 0, messages: 0, community: false };

/** Numbers for the navigation badges. Polls, and refreshes at once when Realtime reports a change. */
export function useUnreadCounts(userId: string | undefined): UnreadCounts {
  const [counts, setCounts] = useState<{ userId: string; value: UnreadCounts } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    const run = () => {
      void Promise.all([countUnreadNotifications(), countUnreadMessages(), getLatestCommunityActivity(userId)]).then(
        ([notifications, messages, latest]) => {
          if (!active) return;
          const seen = getCommunitySeen();
          const community = latest !== null && (seen === null || latest > seen);
          setCounts({ userId, value: { notifications, messages, community } });
        },
      );
    };

    run();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') run();
    }, 30000);
    window.addEventListener(COUNTS_EVENT, run);
    const stops = [
      subscribeToTable(`counts-notifications-${userId}`, 'notifications', run, `user_id=eq.${userId}`),
      subscribeToTable(`counts-messages-${userId}`, 'messages', run),
    ];

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(COUNTS_EVENT, run);
      stops.forEach((stop) => stop());
    };
  }, [userId]);

  return counts && counts.userId === userId ? counts.value : NONE;
}
