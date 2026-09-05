import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';

export interface RiderOnboardingGateData {
  onboardingStatus: string;
  riderChannel: 'GUEST' | 'IN_HOUSE' | null;
  requestedRiderChannel: 'GUEST' | 'IN_HOUSE' | null;
  channelAuthorizationRequired: boolean;
  canAccessWork: boolean;
}

export function isRiderOnboardingGateData(value: unknown): value is RiderOnboardingGateData {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<RiderOnboardingGateData>;
  const validChannel = candidate.riderChannel === null
    || candidate.riderChannel === 'GUEST'
    || candidate.riderChannel === 'IN_HOUSE';
  const validRequestedChannel = candidate.requestedRiderChannel === null
    || candidate.requestedRiderChannel === 'GUEST'
    || candidate.requestedRiderChannel === 'IN_HOUSE';

  return typeof candidate.onboardingStatus === 'string'
    && validChannel
    && validRequestedChannel
    && typeof candidate.channelAuthorizationRequired === 'boolean'
    && typeof candidate.canAccessWork === 'boolean';
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

  const hasAuthoritativeStatus = isRiderOnboardingGateData(query.data);

  return {
    ...query,
    hasAuthoritativeStatus,
    isActivated: hasAuthoritativeStatus && query.data?.canAccessWork === true,
  };
}
