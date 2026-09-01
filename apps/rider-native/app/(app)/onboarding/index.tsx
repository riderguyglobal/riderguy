import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAuthErrorMessage, useAuth } from '@riderguy/auth-native';
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
  const queryClient = useQueryClient();
  const [invitationCode, setInvitationCode] = useState('');
  const [channelError, setChannelError] = useState('');

  const { data: progress, isLoading, isFetching, refetch } = useQuery({
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
  const activatedWithoutChannel = progress?.onboardingStatus === 'ACTIVATED' && !progress?.riderChannel;
  const canChooseChannel = !progress?.riderChannel && !activatedWithoutChannel;

  const channelMutation = useMutation({
    mutationFn: async ({ channel, code }: { channel: 'GUEST' | 'IN_HOUSE'; code?: string }) => {
      const { data } = await api.post('/riders/onboarding/channel', {
        channel,
        ...(code ? { invitationCode: code.trim() } : {}),
      });
      return data.data ?? data;
    },
    onSuccess: async () => {
      setChannelError('');
      setInvitationCode('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rider-onboarding-status'] }),
        queryClient.invalidateQueries({ queryKey: ['rider-profile'] }),
      ]);
    },
    onError: (error) => setChannelError(getAuthErrorMessage(error, 'Could not confirm this Rider channel.')),
  });

  const openStep = (key: string) => {
    const route = key.startsWith('training_') ? '/(app)/training' : ROUTE_BY_STEP[key];
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
        title={!progress?.riderChannel ? 'Rider onboarding' : progress.riderChannel === 'IN_HOUSE' ? 'Trained In-House onboarding' : 'Guest Rider onboarding'}
        subtitle={!progress?.riderChannel
          ? 'Choose the correct channel to continue'
          : progress.riderChannel === 'IN_HOUSE'
            ? 'Confirm your RiderGuy training and verification'
            : 'Complete identity and vehicle verification'}
        canGoBack
        right={<StatusPill status={progress?.onboardingStatus} />}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={riderColors.green} />}
        showsVerticalScrollIndicator={false}
      >
        {canChooseChannel && !isLoading ? (
          <RiderCard style={{ marginBottom: 14, padding: 16 }}>
            <Text style={{ color: riderColors.ink, fontSize: 18, fontWeight: '900' }}>Confirm your Rider channel</Text>
            <Text style={{ color: riderColors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }}>
              Guest Riders can continue independently. RiderGuy issues In-House codes after trainee enrolment and sends the code to the email address or phone number recorded for that Rider.
            </Text>

            <RiderButton
              label="Continue as 3rd Party Rider (Guest)"
              icon="bicycle-outline"
              loading={channelMutation.isPending && channelMutation.variables?.channel === 'GUEST'}
              disabled={channelMutation.isPending}
              onPress={() => channelMutation.mutate({ channel: 'GUEST' })}
              style={{ marginTop: 14 }}
            />

            <View style={{ height: 1, backgroundColor: riderColors.line, marginVertical: 16 }} />
            <Text style={{ color: riderColors.ink, fontSize: 14, fontWeight: '900' }}>RiderGuy Trained In-House Rider</Text>
            <TextInput
              value={invitationCode}
              onChangeText={(value) => { setInvitationCode(value.toUpperCase()); setChannelError(''); }}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="Enter your RiderGuy invitation code"
              placeholderTextColor={riderColors.soft}
              style={{
                marginTop: 10,
                borderWidth: 1,
                borderColor: channelError ? '#DC2626' : riderColors.line,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: riderColors.ink,
                fontWeight: '800',
                backgroundColor: riderColors.white,
              }}
            />
            {channelError ? <Text style={{ color: '#B91C1C', fontSize: 12, lineHeight: 17, marginTop: 7 }}>{channelError}</Text> : null}
            <RiderButton
              label="Verify In-House Invitation"
              icon="shield-checkmark-outline"
              variant="dark"
              loading={channelMutation.isPending && channelMutation.variables?.channel === 'IN_HOUSE'}
              disabled={channelMutation.isPending || invitationCode.trim().length < 8}
              onPress={() => channelMutation.mutate({ channel: 'IN_HOUSE', code: invitationCode })}
              style={{ marginTop: 10 }}
            />
          </RiderCard>
        ) : null}

        {activatedWithoutChannel && !isLoading ? (
          <RiderCard style={{ marginBottom: 14, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: riderColors.amberSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="shield-checkmark-outline" size={23} color="#9A5F05" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: riderColors.ink, fontSize: 16, fontWeight: '900' }}>RiderGuy must confirm this channel</Text>
                <Text style={{ color: riderColors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                  This is an activated legacy account, so its Rider channel cannot be changed inside the app. RiderGuy support must classify it as Guest or In-House from the admin review screen.
                </Text>
              </View>
            </View>
            <RiderButton
              label="Refresh Account Status"
              icon="refresh-outline"
              variant="light"
              loading={isFetching}
              onPress={() => refetch()}
              style={{ marginTop: 12 }}
            />
          </RiderCard>
        ) : null}

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

        {progress?.riderChannel === 'IN_HOUSE' ? (
          <RiderCard style={{ marginBottom: 14, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 17, backgroundColor: '#F0EBFF', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="bicycle-outline" size={25} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: riderColors.ink, fontSize: 16, fontWeight: '900' }}>12-Month Asset Lease</Text>
                <Text style={{ color: riderColors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 }}>
                  Finish verified training, then register interest in a reviewed bike or EV lease program.
                </Text>
              </View>
            </View>
            <RiderButton
              label="Explore Asset Financing"
              icon="arrow-forward"
              variant="light"
              onPress={() => router.push('/(app)/asset-financing')}
              style={{ marginTop: 12 }}
            />
          </RiderCard>
        ) : null}

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
            const disabled = !(ROUTE_BY_STEP[step.key] || step.key.startsWith('training_'));
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
