import { View } from 'react-native';
import { EmptyState, RiderButton } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

export function RiderAccessCheckUnavailable({
  isRetrying,
  onRetry,
}: {
  isRetrying: boolean;
  onRetry: () => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: riderColors.surface,
        paddingHorizontal: 20,
      }}
    >
      <View style={{ width: '100%', maxWidth: 420 }}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Rider access could not be verified"
          body="Check your connection and retry. Your Rider channel and work access will not change unless RiderGuy confirms your current status."
          action={
            <RiderButton
              label="Retry access check"
              icon="refresh-outline"
              loading={isRetrying}
              onPress={onRetry}
            />
          }
        />
      </View>
    </View>
  );
}
