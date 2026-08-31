import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';

/**
 * Lightweight notification summary shared by the tab headers.
 * The API calculates unreadCount across every notification, so the badge
 * remains accurate even when the first page contains only read items.
 */
export function useUnreadNotifications() {
  const { api } = useAuth();

  const query = useQuery({
    queryKey: ['notifications-summary'],
    queryFn: async () => {
      const { data } = await api.get('/notifications?pageSize=1');
      return Number(data?.unreadCount ?? data?.data?.unreadCount ?? 0);
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  return {
    ...query,
    unreadCount: typeof query.data === 'number' && Number.isFinite(query.data) ? query.data : 0,
  };
}
