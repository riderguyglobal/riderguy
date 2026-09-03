import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import { RiderButton, RiderCard, RiderHeader, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

type AssetChoice = 'MOTORBIKE' | 'ELECTRIC_VEHICLE';
type InterestStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'DECLINED' | 'WITHDRAWN';

type AssetInterest = {
  id: string;
  assetType: AssetChoice;
  status: InterestStatus;
  contactEmail: string;
  notes: string | null;
  reviewNotes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  updatedAt: string;
};

type AssetInterestState = {
  interest: AssetInterest | null;
  verifiedContactEmail: string | null;
};

type TrainingResponse = {
  riderChannel: 'GUEST' | 'IN_HOUSE' | null;
  modules: { completedAt: string | null; verifiedAt: string | null }[];
};

const ASSET_OPTIONS: {
  value: AssetChoice;
  title: string;
  body: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  {
    value: 'MOTORBIKE',
    title: 'Motorbike',
    body: 'A practical delivery bike for everyday routes.',
    icon: 'motorbike',
  },
  {
    value: 'ELECTRIC_VEHICLE',
    title: 'Electric vehicle',
    body: 'An electric bike or EV matched to your work needs.',
    icon: 'bike-fast',
  },
];

const STEPS = [
  {
    icon: 'school-outline' as const,
    title: 'Complete training',
    body: 'Finish your RiderGuy training and certification path.',
  },
  {
    icon: 'document-text-outline' as const,
    title: 'Eligibility review',
    body: 'We review your rider status, documents, and selected asset.',
  },
  {
    icon: 'bicycle-outline' as const,
    title: 'Receive an offer',
    body: 'If you qualify and an asset is available, RiderGuy or a named partner will provide separate terms.',
  },
  {
    icon: 'calendar-outline' as const,
    title: 'Pay monthly if accepted',
    body: 'After signing a separate lease agreement, follow its 12-month payment schedule.',
  },
];

const CLOSED_INTEREST_STATUSES = new Set<InterestStatus>(['DECLINED', 'WITHDRAWN']);

const INTEREST_STATUS_COPY: Record<InterestStatus, { label: string; message: string }> = {
  SUBMITTED: {
    label: 'Submitted',
    message: 'Your interest is safely registered and waiting for the RiderGuy review team.',
  },
  UNDER_REVIEW: {
    label: 'Under review',
    message:
      'The RiderGuy team is reviewing your training, preferred asset, and program eligibility.',
  },
  APPROVED: {
    label: 'Approved',
    message:
      'Your interest has been approved. RiderGuy will contact you with availability and separate lease terms.',
  },
  DECLINED: {
    label: 'Not approved',
    message:
      'This request was not approved. You may register again if your circumstances or preferred asset change.',
  },
  WITHDRAWN: {
    label: 'Withdrawn',
    message: 'This request is closed. You may register a new interest when you are ready.',
  },
};

export default function AssetFinancingScreen() {
  const { api, user } = useAuth();
  const [assetChoice, setAssetChoice] = useState<AssetChoice>('MOTORBIKE');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const training = useQuery({
    queryKey: ['rider-training', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/riders/training');
      return (data.data ?? data) as TrainingResponse;
    },
  });

  const interestState = useQuery({
    queryKey: ['rider-asset-financing-interest', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/riders/asset-financing/interests');
      return (data.data ?? data) as AssetInterestState;
    },
    enabled: Boolean(user?.id),
  });

  const currentInterest = interestState.data?.interest ?? null;
  const hasActiveInterest = Boolean(
    currentInterest && !CLOSED_INTEREST_STATUSES.has(currentInterest.status),
  );

  useEffect(() => {
    if (currentInterest?.assetType) setAssetChoice(currentInterest.assetType);
  }, [currentInterest?.assetType]);

  const trainingStatus = useMemo(() => {
    if (training.isLoading) {
      return {
        status: 'PENDING',
        label: 'Checking training',
        message: 'Confirming your RiderGuy training status.',
        eligible: false,
      };
    }

    if (training.isError) {
      return {
        status: 'PENDING',
        label: 'Status unavailable',
        message: 'Your training status could not be confirmed. Retry before registering interest.',
        eligible: false,
      };
    }

    const modules = training.data?.modules ?? [];
    const verified = modules.filter((module) => module.verifiedAt).length;
    const allVerified = modules.length > 0 && verified === modules.length;

    if (training.data?.riderChannel === 'IN_HOUSE' && allVerified) {
      return {
        status: 'COMPLETED',
        label: 'Training verified',
        message:
          'Your In-House training is verified. You can register interest in the lease program.',
        eligible: true,
      };
    }

    if (training.data?.riderChannel === 'IN_HOUSE') {
      return {
        status: 'PENDING',
        label: `${verified}/${modules.length || 3} verified`,
        message:
          'Complete every module and wait for RiderGuy verification before registering interest.',
        eligible: false,
      };
    }

    return {
      status: 'REGISTERED',
      label: 'Training required',
      message: 'The current lease-interest pilot is for verified RiderGuy In-House Riders.',
      eligible: false,
    };
  }, [training.data, training.isError, training.isLoading]);

  const submitInterest = async () => {
    if (!trainingStatus.eligible) {
      Alert.alert(
        'Training verification required',
        'Complete and verify your In-House training before registering interest.',
      );
      return;
    }

    if (interestState.isLoading || interestState.isError) {
      Alert.alert(
        'Interest status unavailable',
        'Retry the status check before registering interest.',
      );
      return;
    }

    if (!interestState.data?.verifiedContactEmail) {
      Alert.alert(
        'Verified email required',
        'Verify your RiderGuy account email before registering interest.',
      );
      return;
    }

    if (hasActiveInterest) {
      Alert.alert(
        'Already registered',
        'Your current asset-financing interest is already registered.',
      );
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/riders/asset-financing/interests', {
        assetType: assetChoice,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });

      await interestState.refetch();

      Alert.alert(
        'Interest registered',
        'The RiderGuy team will review your training status and contact you about eligibility, available assets, and final terms. This is not financing approval or a lease agreement.',
      );
      setNotes('');
    } catch (error: any) {
      Alert.alert(
        'Could not register interest',
        error?.response?.data?.error?.message ?? 'Please check your connection and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: riderColors.surface }}
      edges={['top', 'bottom']}
    >
      <RiderHeader
        title="Asset Financing"
        subtitle="12-month asset lease for trained Riders"
        canGoBack
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <RiderCard dark style={{ overflow: 'hidden', marginBottom: 14 }}>
            <View
              style={{
                position: 'absolute',
                width: 190,
                height: 190,
                borderRadius: 95,
                right: -74,
                top: -82,
                backgroundColor: 'rgba(64,190,137,0.17)',
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    alignSelf: 'flex-start',
                    borderRadius: 999,
                    backgroundColor: riderColors.green,
                    paddingHorizontal: 11,
                    paddingVertical: 5,
                  }}
                >
                  <Text
                    style={{
                      color: riderColors.ink,
                      fontSize: 10,
                      fontWeight: '900',
                      letterSpacing: 0.4,
                    }}
                  >
                    12 MONTHS
                  </Text>
                </View>
                <Text
                  style={{
                    color: riderColors.white,
                    fontSize: 24,
                    lineHeight: 30,
                    fontWeight: '900',
                    marginTop: 13,
                  }}
                >
                  Get equipped to work.
                </Text>
                <Text style={{ color: '#B8C8BF', fontSize: 12.5, lineHeight: 19, marginTop: 7 }}>
                  Eligible trained Riders can register interest in a reviewed 12-month bike or EV
                  lease program.
                </Text>
              </View>
              <View
                style={{
                  width: 78,
                  height: 78,
                  borderRadius: 26,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialCommunityIcons
                  name="motorbike-electric"
                  size={47}
                  color={riderColors.green}
                />
              </View>
            </View>
          </RiderCard>

          <RiderCard style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
                <Text style={{ color: riderColors.ink, fontSize: 14, fontWeight: '900' }}>
                  Your interest status
                </Text>
                {interestState.isLoading ? (
                  <Text
                    style={{
                      color: riderColors.muted,
                      fontSize: 11.5,
                      lineHeight: 17,
                      marginTop: 4,
                    }}
                  >
                    Checking for an existing request…
                  </Text>
                ) : interestState.isError ? (
                  <Text
                    style={{
                      color: riderColors.muted,
                      fontSize: 11.5,
                      lineHeight: 17,
                      marginTop: 4,
                    }}
                  >
                    Your request status could not be confirmed. Registration stays locked until this
                    check succeeds.
                  </Text>
                ) : currentInterest ? (
                  <>
                    <Text
                      style={{
                        color: riderColors.muted,
                        fontSize: 11.5,
                        lineHeight: 17,
                        marginTop: 4,
                      }}
                    >
                      {INTEREST_STATUS_COPY[currentInterest.status].message}
                    </Text>
                    <Text
                      style={{
                        color: riderColors.soft,
                        fontSize: 10.5,
                        lineHeight: 16,
                        marginTop: 7,
                      }}
                    >
                      {currentInterest.assetType === 'MOTORBIKE' ? 'Motorbike' : 'Electric vehicle'}{' '}
                      · Submitted{' '}
                      {new Date(currentInterest.submittedAt).toLocaleDateString('en-GB')}
                    </Text>
                    {currentInterest.reviewNotes ? (
                      <View
                        accessibilityRole="summary"
                        style={{
                          marginTop: 12,
                          borderRadius: 13,
                          borderWidth: 1,
                          borderColor:
                            currentInterest.status === 'DECLINED' ? '#F6C7C2' : '#B7EFD8',
                          backgroundColor:
                            currentInterest.status === 'DECLINED'
                              ? riderColors.redSoft
                              : riderColors.greenSoft,
                          padding: 11,
                        }}
                      >
                        <Text
                          style={{
                            color: riderColors.ink,
                            fontSize: 10,
                            fontWeight: '900',
                            textTransform: 'uppercase',
                          }}
                        >
                          RiderGuy review feedback
                        </Text>
                        <Text
                          style={{
                            color: riderColors.ink,
                            fontSize: 11.5,
                            lineHeight: 18,
                            marginTop: 4,
                          }}
                        >
                          {currentInterest.reviewNotes}
                        </Text>
                        {currentInterest.status === 'DECLINED' ? (
                          <Text
                            style={{
                              color: '#9F241B',
                              fontSize: 10.5,
                              lineHeight: 16,
                              fontWeight: '700',
                              marginTop: 7,
                            }}
                          >
                            Address this feedback before sending a new request below.
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                    {currentInterest.reviewedAt ? (
                      <Text
                        style={{
                          color: riderColors.soft,
                          fontSize: 10,
                          lineHeight: 15,
                          marginTop: 7,
                        }}
                      >
                        Reviewed {new Date(currentInterest.reviewedAt).toLocaleDateString('en-GB')}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text
                    style={{
                      color: riderColors.muted,
                      fontSize: 11.5,
                      lineHeight: 17,
                      marginTop: 4,
                    }}
                  >
                    No interest is registered yet.
                  </Text>
                )}
              </View>
              {currentInterest ? (
                <StatusPill
                  status={
                    currentInterest.status === 'DECLINED' ? 'REJECTED' : currentInterest.status
                  }
                  label={INTEREST_STATUS_COPY[currentInterest.status].label}
                />
              ) : null}
            </View>
            {interestState.isError ? (
              <RiderButton
                label="Retry Interest Check"
                icon="refresh"
                variant="light"
                onPress={() => void interestState.refetch()}
                style={{ marginTop: 12 }}
              />
            ) : interestState.data?.verifiedContactEmail ? (
              <View
                style={{
                  marginTop: 12,
                  borderRadius: 13,
                  backgroundColor: riderColors.panelAlt,
                  padding: 11,
                }}
              >
                <Text
                  style={{
                    color: riderColors.soft,
                    fontSize: 10,
                    fontWeight: '800',
                    textTransform: 'uppercase',
                  }}
                >
                  Verified contact email
                </Text>
                <Text
                  style={{ color: riderColors.ink, fontSize: 12, fontWeight: '800', marginTop: 3 }}
                >
                  {interestState.data.verifiedContactEmail}
                </Text>
              </View>
            ) : !interestState.isLoading ? (
              <Text style={{ color: '#B45309', fontSize: 11, lineHeight: 17, marginTop: 10 }}>
                Verify an account email before registering interest. Alternate unverified addresses
                are not accepted.
              </Text>
            ) : null}
          </RiderCard>

          <RiderCard style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
                <Text style={{ color: riderColors.ink, fontSize: 14, fontWeight: '900' }}>
                  Your eligibility path
                </Text>
                <Text
                  style={{ color: riderColors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 3 }}
                >
                  {trainingStatus.message}
                </Text>
              </View>
              <StatusPill status={trainingStatus.status} label={trainingStatus.label} />
            </View>
            {training.isError ? (
              <RiderButton
                label="Retry Training Check"
                icon="refresh"
                variant="light"
                onPress={() => void training.refetch()}
                style={{ marginTop: 12 }}
              />
            ) : !training.isLoading && !trainingStatus.eligible ? (
              <RiderButton
                label={
                  training.data?.riderChannel === 'IN_HOUSE'
                    ? 'Continue Training'
                    : 'View Training Information'
                }
                icon="school-outline"
                variant="light"
                onPress={() => router.push('/(app)/training')}
                style={{ marginTop: 12 }}
              />
            ) : null}
          </RiderCard>

          <Text
            style={{ color: riderColors.ink, fontSize: 16, fontWeight: '900', marginBottom: 9 }}
          >
            Choose an asset
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
            {ASSET_OPTIONS.map((option) => {
              const selected = assetChoice === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  activeOpacity={0.84}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={option.title}
                  onPress={() => setAssetChoice(option.value)}
                  style={{
                    flex: 1,
                    minHeight: 145,
                    borderRadius: 18,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? riderColors.greenDark : riderColors.line,
                    backgroundColor: selected ? riderColors.greenMist : riderColors.white,
                    padding: 13,
                  }}
                >
                  <View
                    style={{
                      width: 45,
                      height: 45,
                      borderRadius: 16,
                      backgroundColor: selected ? riderColors.greenSoft : riderColors.panelAlt,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MaterialCommunityIcons
                      name={option.icon}
                      size={25}
                      color={selected ? riderColors.greenDark : riderColors.muted}
                    />
                  </View>
                  <Text
                    style={{
                      color: riderColors.ink,
                      fontSize: 13,
                      fontWeight: '900',
                      marginTop: 10,
                    }}
                  >
                    {option.title}
                  </Text>
                  <Text
                    style={{
                      color: riderColors.muted,
                      fontSize: 10.5,
                      lineHeight: 15,
                      marginTop: 4,
                    }}
                  >
                    {option.body}
                  </Text>
                  {selected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={riderColors.greenDark}
                      style={{ position: 'absolute', top: 10, right: 10 }}
                    />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text
            style={{ color: riderColors.ink, fontSize: 16, fontWeight: '900', marginBottom: 9 }}
          >
            How the program works
          </Text>
          <RiderCard style={{ paddingVertical: 8, marginBottom: 18 }}>
            {STEPS.map((step, index) => (
              <View
                key={step.title}
                style={{
                  minHeight: 67,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 9,
                  borderBottomWidth: index < STEPS.length - 1 ? 1 : 0,
                  borderBottomColor: riderColors.line,
                }}
              >
                <View
                  style={{
                    width: 41,
                    height: 41,
                    borderRadius: 15,
                    backgroundColor: riderColors.greenSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={step.icon} size={20} color={riderColors.greenDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: riderColors.ink, fontSize: 13, fontWeight: '900' }}>
                    {step.title}
                  </Text>
                  <Text
                    style={{ color: riderColors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 }}
                  >
                    {step.body}
                  </Text>
                </View>
                <View
                  style={{
                    width: 23,
                    height: 23,
                    borderRadius: 12,
                    backgroundColor: riderColors.panelAlt,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: riderColors.greenDark, fontSize: 10, fontWeight: '900' }}>
                    {index + 1}
                  </Text>
                </View>
              </View>
            ))}
          </RiderCard>

          {trainingStatus.eligible &&
          !interestState.isLoading &&
          !interestState.isError &&
          Boolean(interestState.data?.verifiedContactEmail) &&
          !hasActiveInterest ? (
            <RiderCard style={{ gap: 13, marginBottom: 12 }}>
              <View>
                <Text style={{ color: riderColors.ink, fontSize: 16, fontWeight: '900' }}>
                  Register your interest
                </Text>
                <Text
                  style={{ color: riderColors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 4 }}
                >
                  Send your preferred asset to RiderGuy support. Eligibility, availability, pricing,
                  deposits, and final lease terms are confirmed after review.
                </Text>
                <Text
                  style={{ color: riderColors.soft, fontSize: 10.5, lineHeight: 16, marginTop: 7 }}
                >
                  This request is linked to your Rider profile and uses only your verified RiderGuy
                  account email, preferred asset, training status, and any notes you enter.
                </Text>
              </View>

              <View>
                <Text
                  style={{
                    color: riderColors.ink,
                    fontSize: 12,
                    fontWeight: '900',
                    marginBottom: 7,
                  }}
                >
                  Anything we should know? (optional)
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  accessibilityLabel="Optional lease-interest notes"
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                  placeholder="Tell us about the routes you cover or the asset you prefer."
                  placeholderTextColor={riderColors.soft}
                  style={{
                    minHeight: 96,
                    borderRadius: 15,
                    borderWidth: 1,
                    borderColor: riderColors.line,
                    backgroundColor: riderColors.panelAlt,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: riderColors.ink,
                    fontSize: 13,
                    lineHeight: 19,
                  }}
                />
              </View>

              <RiderButton
                label="Register Interest"
                icon="send"
                loading={submitting}
                onPress={submitInterest}
              />
            </RiderCard>
          ) : (
            <RiderCard style={{ marginBottom: 12 }}>
              <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900' }}>
                Interest registration is locked
              </Text>
              <Text
                style={{ color: riderColors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }}
              >
                {hasActiveInterest
                  ? 'Your current request is already registered. Its live status appears above.'
                  : interestState.isError
                    ? 'Retry the interest-status check before registering.'
                    : !interestState.data?.verifiedContactEmail && !interestState.isLoading
                      ? 'Verify your RiderGuy account email before registering.'
                      : 'It opens only after all In-House training modules are completed and verified by RiderGuy. This does not block you from reviewing how the program works.'}
              </Text>
            </RiderCard>
          )}

          <Text
            style={{
              color: riderColors.soft,
              fontSize: 10.5,
              lineHeight: 16,
              textAlign: 'center',
              paddingHorizontal: 8,
            }}
          >
            Registering interest does not guarantee approval or reserve an asset. Final financial
            and lease terms are provided before you agree to anything.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
