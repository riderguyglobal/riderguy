export function resolveRiderNotificationRoute(
  data?: Record<string, unknown> | null,
  type?: string | null,
): string | null {
  const orderId = stringValue(data?.orderId);
  if (orderId) return `/(app)/jobs/${orderId}`;

  if (stringValue(data?.mentorshipId)) return '/(app)/community/mentorship';
  if (stringValue(data?.announcementId) || data?.context === 'ANNOUNCEMENT') {
    return '/(tabs)';
  }
  if (stringValue(data?.assetFinancingInterestId) || data?.context === 'ASSET_FINANCING') {
    return '/(app)/asset-financing';
  }
  if (
    stringValue(data?.cancellationRecordId) ||
    stringValue(data?.cancellationAppealId) ||
    data?.context === 'CANCELLATION'
  ) {
    return '/(app)/cancellations';
  }
  if (stringValue(data?.documentType)) return '/(app)/onboarding/documents';
  if (stringValue(data?.vehicleId)) return '/(app)/onboarding/vehicle';

  const status = stringValue(data?.status)?.toUpperCase();
  if (status === 'ACTIVATED') return '/(tabs)';
  if (status === 'APPLICATION_REJECTED') return '/(app)/onboarding';

  const normalizedType = type?.toUpperCase();
  if (normalizedType === 'PAYMENT') return '/(tabs)/earnings';
  if (normalizedType === 'TRAINING') return '/(app)/training';
  if (normalizedType === 'COMMUNITY') return '/(tabs)/community';
  if (normalizedType === 'GAMIFICATION') return '/(app)/gamification';
  return null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
