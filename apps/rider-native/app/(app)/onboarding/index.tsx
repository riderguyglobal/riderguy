import { ScrollView, Text, TouchableOpacity, View, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import { EmptyState, ProgressBar, RiderButton, RiderCard, RiderHeader, StatusPill } from '@/components/rider-ui';
import { cleanLabel, riderColors } from '@/lib/rider-design';

const ROUTE_BY_STEP: Record<string, string> = {
  national_id: '/(app)/onboarding/documents',
  drivers_license: '/(app)/onboarding/documents',
  insurance: '/(app)/onboarding/documents',
  selfie: '/(app)/onboarding/selfie',
  vehicle_registration: '/(app)/onboarding/vehicle',
  vehicle_photos: '/(app)/onboarding/vehicle-photos',
};

function iconForStatus(status: string) {
  if (status === 'completed') return 'checkmark-circle';
  if (status === 'current') return 'radio';
  return 'ellipse-outline';
}

export default function OnboardingIndexScreen() {
  const { api } = useAuth();

  const { data: progress, isLoading, refetch } = useQuery({
    queryKey: ['rider-onboarding-status'],
    queryFn: async () => {
      const { data } = await api.get('/riders/onboarding');
      return data.data ?? data;
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ['rider-vehicles'],
    queryFn: async () => {
      const { data } = await api.get('/riders/vehicles');
      return (data.data ?? data) as any[];
    },
  });

  const firstVehicleId = vehicles?.[0]?.id;
  const steps = progress?.steps ?? [];

  const openStep = (key: string) => {
    const route = ROUTE_BY_STEP[key];
    if (!route) return;
    if (key === 'vehicle_photos' && firstVehicleId) {
      router.push({ pathname: route as any, params: { vehicleId: firstVehicleId } });
      return;
    }
    router.push(route as any);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader
        title="Rider verification"
        subtitle="Complete the essentials before dispatch activation"
        canGoBack
        right={<StatusPill status={progress?.onboardingStatus} />}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={riderColors.green} />}
        showsVerticalScrollIndicator={false}
      >
        <RiderCard dark style={{ marginBottom: 14 }}>
          <Text style={{ color: '#9fb0c4', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' }}>Activation progress</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 }}>
            <Text style={{ color: riderColors.white, fontSize: 36, fontWeight: '900' }}>{progress?.overallProgress ?? 0}%</Text>
            <StatusPill status={progress?.onboardingStatus} label={cleanLabel(progress?.onboardingStatus)} />
          </View>
          <ProgressBar progress={progress?.overallProgress ?? 0} color={riderColors.green} />
          <Text style={{ color: '#9fb0c4', fontSize: 12, lineHeight: 18, marginTop: 12 }}>
            Submit clear documents and vehicle details. The review team will activate the account once required checks pass.
          </Text>
        </RiderCard>

        {steps.length === 0 && !isLoading ? (
          <EmptyState
            icon="document-text-outline"
            title="Onboarding is not available"
            body="Refresh the page or sign in again if this does not load."
            action={<RiderButton label="Refresh" onPress={() => refetch()} />}
          />
        ) : null}

        <View style={{ gap: 10 }}>
          {steps.map((step: any, index: number) => {
            const disabled = !ROUTE_BY_STEP[step.key];
            const current = step.status === 'current';
            const completed = step.status === 'completed';
            return (
              <TouchableOpacity
                key={step.key}
                activeOpacity={0.84}
                disabled={disabled}
                onPress={() => openStep(step.key)}
              >
                <RiderCard style={{ opacity: disabled ? 0.75 : 1, padding: 15 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                    <View style={{
                      width: 46,
                      height: 46,
                      borderRadius: 16,
                      backgroundColor: completed ? riderColors.greenSoft : current ? riderColors.amberSoft : riderColors.panelAlt,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons
                        name={iconForStatus(step.status) as any}
                        size={23}
                        color={completed ? riderColors.greenDark : current ? riderColors.amber : riderColors.soft}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900', flex: 1 }}>{step.label}</Text>
                        {step.optional ? <StatusPill status="OFFLINE" label="Optional" /> : null}
                      </View>
                      <Text style={{ color: riderColors.muted, fontSize: 12, lineHeight: 18 }}>{step.description}</Text>
                    </View>
                    {!disabled ? <Ionicons name="chevron-forward" size={18} color={riderColors.soft} /> : <Text style={{ color: riderColors.soft, fontWeight: '900' }}>{index + 1}</Text>}
                  </View>
                </RiderCard>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
