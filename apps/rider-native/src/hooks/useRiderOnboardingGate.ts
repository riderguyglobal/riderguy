import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';

export interface RiderOnboardingGateData {
  onboardingStatus: string;
  riderChannel: 'GUEST' | 'IN_HOUSE' | null;
  requestedRiderChannel: 'GUEST' | 'IN_HOUSE' | null;
  channelAuthorizationRequired: boolean;
  canAccessWork: boolean;
}

/**
 * One shared, server-authoritative gate for every protected Rider route.
 * UI state never grants access; only an activated + verified server profile
 * returns canAccessWork=true.
 */
export function useRiderOnboardingGate() {
  const { api, isAuthenticated } = useAuth();
  const query = useQuery<RiderOnboardingGateData>({
    queryKey: ['rider-onboarding-status'],
    queryFn: async () => {
      const { data } = await api.get('/riders/onboarding');
      return data.data ?? data;
    },
    enabled: isAuthenticated,
    staleTime: 15_000,
    retry: 2,
  });

  return {
    ...query,
    isActivated: query.data?.canAccessWork === true,
  };
}
