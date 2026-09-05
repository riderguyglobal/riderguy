import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
import { BrandHeader, RiderButton, StatusPill } from '@/components/rider-ui';
import { RiderNavigationMenu } from '@/components/rider-navigation-menu';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { riderColors, riderFonts, riderShadow } from '@/lib/rider-design';

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

type TrainingModule = {
  completedAt: string | null;
  verifiedAt: string | null;
};

type TrainingResponse = {
  riderChannel: 'GUEST' | 'IN_HOUSE' | null;
  modules: TrainingModule[];
};

type TrainingStatus = {
  status: string;
  label: string;
  message: string;
  eligible: boolean;
  verified: number;
  total: number;
};

const heroArt = require('../../assets/images/illustrations/rider-asset-scooter-v1.png');
const motorbikeArt = require('../../assets/images/illustrations/rider-asset-motorbike-v1.png');
const scooterArt = require('../../assets/images/illustrations/rider-asset-scooter-v1.png');

const ASSET_OPTIONS: {
  value: AssetChoice;
  title: string;
  body: string;
  tag: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  image: number;
}[] = [
  {
    value: 'MOTORBIKE',
    title: 'Delivery motorbike',
    body: 'A practical petrol bike preference for everyday delivery routes.',
    tag: 'Motorbike',
    icon: 'motorbike',
    image: motorbikeArt,
  },
  {
    value: 'ELECTRIC_VEHICLE',
    title: 'Electric vehicle',
    body: 'Register interest in an electric bike or EV matched after review.',
    tag: 'Electric',
    icon: 'motorbike-electric',
    image: scooterArt,
  },
];

const PROGRAM_BENEFITS: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}[] = [
  {
    icon: 'calendar-outline',
    title: '12-month path',
    body: 'Program structure with final terms shared separately.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Verified access',
    body: 'Training and account checks are confirmed first.',
  },
  {
    icon: 'bicycle-outline',
    title: 'Asset choice',
    body: 'Choose a motorbike or electric-vehicle preference.',
  },
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'Review feedback',
    body: 'Track the decision and any notes from RiderGuy.',
  },
];

const STEPS = [
  {
    icon: 'school-outline' as const,
    title: 'Complete training',
    body: 'Finish every RiderGuy In-House module and wait for verification.',
  },
  {
    icon: 'document-text-outline' as const,
    title: 'Register interest',
    body: 'Choose your preferred asset and send an optional note.',
  },
  {
    icon: 'search-outline' as const,
    title: 'Eligibility review',
    body: 'RiderGuy reviews your account, training, and request.',
  },
  {
    icon: 'checkmark-circle-outline' as const,
    title: 'Receive the decision',
    body: 'If approved, availability and separate lease terms follow.',
  },
];

const CLOSED_INTEREST_STATUSES = new Set<InterestStatus>(['DECLINED', 'WITHDRAWN']);

const INTEREST_STATUS_COPY: Record<InterestStatus, { label: string; message: string }> = {
  SUBMITTED: {
    label: 'Submitted',
    message: 'Your interest is registered and waiting for the RiderGuy review team.',
  },
  UNDER_REVIEW: {
    label: 'Under review',
    message: 'RiderGuy is reviewing your training, preferred asset, and program eligibility.',
  },
  APPROVED: {
    label: 'Approved',
    message:
      'Your interest was approved. RiderGuy will contact you about availability and separate lease terms.',
  },
  DECLINED: {
    label: 'Not approved',
    message:
      'This request was not approved. You can register again if your circumstances or preference change.',
  },
  WITHDRAWN: {
    label: 'Withdrawn',
    message: 'This request is closed. You can register a new interest when you are ready.',
  },
};

const INTEREST_PROGRESS: Record<InterestStatus, number> = {
  SUBMITTED: 34,
  UNDER_REVIEW: 68,
  APPROVED: 100,
  DECLINED: 100,
  WITHDRAWN: 100,
};

function assetLabel(assetType: AssetChoice) {
  return assetType === 'MOTORBIKE' ? 'Delivery motorbike' : 'Electric vehicle';
}

function formatRequestDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AssetFinancingScreen() {
  const { api, user } = useAuth();
  const { unreadCount } = useUnreadNotifications();
  const scrollRef = useRef<ScrollView>(null);
  const [assetChoice, setAssetChoice] = useState<AssetChoice>('MOTORBIKE');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [assetSectionY, setAssetSectionY] = useState(0);

  const training = useQuery({
    queryKey: ['rider-training', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/riders/training');
      return (data.data ?? data) as TrainingResponse;
    },
    enabled: Boolean(user?.id),
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

  const trainingStatus = useMemo<TrainingStatus>(() => {
    if (training.isLoading) {
      return {
        status: 'PENDING',
        label: 'Checking training',
        message: 'Confirming your RiderGuy training status.',
        eligible: false,
        verified: 0,
        total: 0,
      };
    }

    if (training.isError) {
      return {
        status: 'PENDING',
        label: 'Status unavailable',
        message: 'Your training status could not be confirmed. Retry before registering interest.',
        eligible: false,
        verified: 0,
        total: 0,
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
        verified,
        total: modules.length,
      };
    }

    if (training.data?.riderChannel === 'IN_HOUSE') {
      return {
        status: 'PENDING',
        label: `${verified}/${modules.length || 3} verified`,
        message:
          'Complete every module and wait for RiderGuy verification before registering interest.',
        eligible: false,
        verified,
        total: modules.length || 3,
      };
    }

    return {
      status: 'REGISTERED',
      label: 'Training required',
      message: 'The current lease-interest pilot is for verified RiderGuy In-House Riders.',
      eligible: false,
      verified,
      total: modules.length || 3,
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
      setNotes('');
      Alert.alert(
        'Interest registered',
        'RiderGuy will review your training status and contact you about eligibility, available assets, and final terms. This is not financing approval or a lease agreement.',
      );
    } catch (error: any) {
      Alert.alert(
        'Could not register interest',
        error?.response?.data?.error?.message ?? 'Please check your connection and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const refreshPage = () => {
    void Promise.allSettled([training.refetch(), interestState.refetch()]);
  };

  const scrollToAssets = () => {
    scrollRef.current?.scrollTo({ y: Math.max(0, assetSectionY - 12), animated: true });
  };

  const verifiedEmail = interestState.data?.verifiedContactEmail ?? null;
  const trainingProgress =
    trainingStatus.total > 0
      ? Math.round((trainingStatus.verified / trainingStatus.total) * 100)
      : 0;
  const registrationOpen =
    trainingStatus.eligible &&
    !interestState.isLoading &&
    !interestState.isError &&
    Boolean(verifiedEmail) &&
    !hasActiveInterest;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BrandHeader
        onMenu={() => setMenuOpen(true)}
        onNotifications={() => router.push('/(app)/notifications')}
        unread={unreadCount > 0}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={training.isRefetching || interestState.isRefetching}
              onRefresh={refreshPage}
              tintColor={riderColors.green}
            />
          }
        >
          <View style={styles.pageHeading}>
            <Text style={styles.pageTitle}>Asset Financing</Text>
            <Text style={styles.pageSubtitle}>Get equipped to grow your delivery work.</Text>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroHalo} />
            <View style={styles.calendarBadge}>
              <Ionicons name="calendar-clear-outline" size={17} color="#168C58" />
              <Text style={styles.calendarNumber}>12</Text>
            </View>
            <Text style={styles.heroTitle}>12-Month Lease Program</Text>
            <Text style={styles.heroBody}>
              A reviewed path to a delivery motorbike or electric vehicle.
            </Text>

            <View style={styles.heroBenefitList}>
              <HeroBenefit icon="school-outline" label="Verified training path" />
              <HeroBenefit icon="bicycle-outline" label="Bike & EV preferences" />
              <HeroBenefit icon="document-text-outline" label="Terms confirmed after review" />
            </View>

            <Image source={heroArt} resizeMode="contain" style={styles.heroArt} />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="View asset options"
              activeOpacity={0.86}
              onPress={scrollToAssets}
              style={styles.heroButton}
            >
              <Text style={styles.heroButtonText}>View Asset Options</Text>
            </TouchableOpacity>
          </View>

          <SectionHeading title="Why explore this program?" />
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.benefitRail}
            accessibilityRole="list"
            accessibilityLabel="Program benefits"
          >
            {PROGRAM_BENEFITS.map((benefit) => (
              <View key={benefit.title} style={styles.benefitCard} accessibilityRole="summary">
                <View style={styles.benefitIcon}>
                  <Ionicons name={benefit.icon} size={25} color="#168C58" />
                </View>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitBody}>{benefit.body}</Text>
              </View>
            ))}
          </ScrollView>

          <View onLayout={(event) => setAssetSectionY(event.nativeEvent.layout.y)}>
            <SectionHeading
              title="Asset options"
              action={hasActiveInterest ? 'Request locked' : 'Choose one'}
            />
            <Text style={styles.sectionIntro}>
              This is your preference for review, not live inventory or a reservation.
            </Text>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.assetRail}
              accessibilityRole="radiogroup"
              accessibilityLabel="Preferred asset"
            >
              {ASSET_OPTIONS.map((option) => {
                const selected = assetChoice === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    activeOpacity={0.86}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, disabled: hasActiveInterest }}
                    accessibilityLabel={option.title}
                    disabled={hasActiveInterest}
                    onPress={() => setAssetChoice(option.value)}
                    style={[
                      styles.assetCard,
                      selected ? styles.assetCardSelected : null,
                      hasActiveInterest && !selected ? styles.assetCardDisabled : null,
                    ]}
                  >
                    <View style={styles.assetCardTopRow}>
                      <View style={[styles.assetTag, selected ? styles.assetTagSelected : null]}>
                        <Text
                          style={[
                            styles.assetTagText,
                            selected ? styles.assetTagTextSelected : null,
                          ]}
                        >
                          {selected ? 'Selected' : option.tag}
                        </Text>
                      </View>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={21} color="#168C58" />
                      ) : null}
                    </View>
                    <View style={styles.assetIllustration}>
                      <View style={styles.assetIllustrationHalo} />
                      <Image
                        source={option.image}
                        resizeMode="contain"
                        style={styles.assetProductImage}
                      />
                    </View>
                    <Text style={styles.assetTitle}>{option.title}</Text>
                    <Text style={styles.assetBody}>{option.body}</Text>
                    <View
                      style={[
                        styles.assetChoiceButton,
                        selected ? styles.assetChoiceButtonSelected : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.assetChoiceText,
                          selected ? styles.assetChoiceTextSelected : null,
                        ]}
                      >
                        {selected ? 'Preferred option' : 'Choose this option'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <SectionHeading title="How the program works" />
          <View style={styles.stepsCard}>
            {STEPS.map((step, index) => (
              <View key={step.title} style={styles.stepRow}>
                <View style={styles.stepRail}>
                  <View style={styles.stepIcon}>
                    <Ionicons name={step.icon} size={19} color="#168C58" />
                  </View>
                  {index < STEPS.length - 1 ? <View style={styles.stepLine} /> : null}
                </View>
                <View style={styles.stepCopy}>
                  <Text style={styles.stepEyebrow}>STEP {index + 1}</Text>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepBody}>{step.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <SectionHeading
            title={currentInterest ? 'My financing request' : 'Application readiness'}
          />
          <View style={styles.statusCard} accessibilityLiveRegion="polite">
            {interestState.isLoading ? (
              <StatusMessage
                icon="hourglass-outline"
                title="Checking your request"
                body="Looking for an existing asset-financing interest."
              />
            ) : interestState.isError ? (
              <>
                <StatusMessage
                  icon="cloud-offline-outline"
                  title="Request status unavailable"
                  body="Registration stays locked until the status check succeeds."
                  tone="warning"
                />
                <RiderButton
                  label="Retry Interest Check"
                  icon="refresh"
                  variant="light"
                  onPress={() => void interestState.refetch()}
                  style={styles.cardButton}
                />
              </>
            ) : currentInterest ? (
              <CurrentRequestCard interest={currentInterest} />
            ) : (
              <>
                <View style={styles.statusHeadingRow}>
                  <View style={styles.statusHeadingCopy}>
                    <Text style={styles.statusTitle}>Ready to register?</Text>
                    <Text style={styles.statusBody}>{trainingStatus.message}</Text>
                  </View>
                  <StatusPill status={trainingStatus.status} label={trainingStatus.label} />
                </View>
                <View style={styles.progressBlock}>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressLabel}>Verified training</Text>
                    <Text style={styles.progressValue}>
                      {trainingStatus.verified}/{trainingStatus.total || 3} modules
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${trainingProgress}%` }]} />
                  </View>
                </View>
                {training.isError ? (
                  <RiderButton
                    label="Retry Training Check"
                    icon="refresh"
                    variant="light"
                    onPress={() => void training.refetch()}
                    style={styles.cardButton}
                  />
                ) : null}
              </>
            )}

            {!interestState.isLoading && !interestState.isError ? (
              currentInterest?.contactEmail || verifiedEmail ? (
                <View style={styles.emailRow}>
                  <Ionicons name="mail-outline" size={18} color="#168C58" />
                  <View style={styles.emailCopy}>
                    <Text style={styles.emailLabel}>
                      {currentInterest ? 'Request contact email' : 'Verified contact email'}
                    </Text>
                    <Text style={styles.emailValue} numberOfLines={1}>
                      {currentInterest?.contactEmail ?? verifiedEmail}
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={19} color="#168C58" />
                </View>
              ) : (
                <View style={styles.emailWarning}>
                  <Ionicons name="alert-circle-outline" size={19} color="#9A5F05" />
                  <Text style={styles.emailWarningText}>
                    Verify an account email before registering interest.
                  </Text>
                </View>
              )
            ) : null}
          </View>

          {registrationOpen ? (
            <View style={styles.registrationCard}>
              <View style={styles.registrationHeading}>
                <View style={styles.registrationIcon}>
                  <Ionicons name="document-text-outline" size={22} color="#168C58" />
                </View>
                <View style={styles.registrationCopy}>
                  <Text style={styles.registrationTitle}>Register your interest</Text>
                  <Text style={styles.registrationBody}>
                    Submit your selected preference for eligibility and availability review.
                  </Text>
                </View>
              </View>
              <Text style={styles.fieldLabel}>Anything we should know? (optional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                accessibilityLabel="Optional lease-interest notes"
                multiline
                maxLength={1000}
                textAlignVertical="top"
                placeholder="Tell us about the routes you cover or the asset you prefer."
                placeholderTextColor={riderColors.soft}
                style={styles.notesInput}
              />
              <View style={styles.selectionSummary}>
                <MaterialCommunityIcons
                  name={assetChoice === 'MOTORBIKE' ? 'motorbike' : 'motorbike-electric'}
                  size={21}
                  color="#168C58"
                />
                <Text style={styles.selectionSummaryText}>
                  Preference: {assetLabel(assetChoice)}
                </Text>
              </View>
              <RiderButton
                label="Register Interest"
                icon="send"
                loading={submitting}
                onPress={submitInterest}
                style={styles.submitButton}
              />
              <Text style={styles.disclosure}>
                Registering interest does not guarantee approval, reserve an asset, or create a
                lease agreement.
              </Text>
            </View>
          ) : (
            <LockedRegistrationCard
              hasActiveInterest={hasActiveInterest}
              interestError={interestState.isError}
              interestLoading={interestState.isLoading}
              trainingStatus={trainingStatus}
              verifiedEmail={verifiedEmail}
              onRetryInterest={() => void interestState.refetch()}
            />
          )}

          <SectionHeading title="Quick actions" />
          <View style={styles.quickActions}>
            <QuickAction
              icon="school-outline"
              title="Training"
              body="View your modules"
              onPress={() => router.push('/(app)/training')}
            />
            <QuickAction
              icon="person-circle-outline"
              title="Profile"
              body="Manage your email"
              onPress={() => router.push('/(app)/settings/profile')}
            />
            <QuickAction
              icon="headset-outline"
              title="Support"
              body="Get help & info"
              onPress={() => router.push('/(app)/settings/about')}
            />
          </View>

          <Text style={styles.footerDisclosure}>
            Final eligibility, asset availability, deposits, pricing, ownership, and lease terms are
            confirmed separately before you agree to anything.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <AssetBottomNavigation
        onActivePress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
      />
      <RiderNavigationMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </SafeAreaView>
  );
}

function HeroBenefit({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.heroBenefitRow}>
      <View style={styles.heroBenefitIcon}>
        <Ionicons name={icon} size={14} color="#168C58" />
      </View>
      <Text style={styles.heroBenefitText}>{label}</Text>
    </View>
  );
}

function SectionHeading({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

function StatusMessage({
  icon,
  title,
  body,
  tone = 'default',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <View style={styles.statusMessage}>
      <View
        style={[
          styles.statusMessageIcon,
          tone === 'warning' ? styles.statusMessageIconWarning : null,
        ]}
      >
        <Ionicons name={icon} size={23} color={tone === 'warning' ? '#9A5F05' : '#168C58'} />
      </View>
      <View style={styles.statusHeadingCopy}>
        <Text style={styles.statusTitle}>{title}</Text>
        <Text style={styles.statusBody}>{body}</Text>
      </View>
    </View>
  );
}

function CurrentRequestCard({ interest }: { interest: AssetInterest }) {
  const copy = INTEREST_STATUS_COPY[interest.status];
  const progress = INTEREST_PROGRESS[interest.status];
  const rejected = interest.status === 'DECLINED';

  return (
    <View>
      <View style={styles.statusHeadingRow}>
        <View style={styles.statusHeadingCopy}>
          <Text style={styles.requestAsset}>{assetLabel(interest.assetType)}</Text>
          <Text style={styles.requestDate}>
            Submitted {formatRequestDate(interest.submittedAt)}
          </Text>
        </View>
        <StatusPill status={rejected ? 'REJECTED' : interest.status} label={copy.label} />
      </View>
      <Text style={styles.requestMessage}>{copy.message}</Text>
      <View style={styles.progressBlock}>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>Request progress</Text>
          <Text style={styles.progressValue}>{progress}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              rejected ? styles.progressFillRejected : null,
              { width: `${progress}%` },
            ]}
          />
        </View>
      </View>
      {interest.reviewNotes ? (
        <View
          style={[styles.reviewBox, rejected ? styles.reviewBoxRejected : null]}
          accessibilityRole="summary"
        >
          <Text style={[styles.reviewLabel, rejected ? styles.reviewLabelRejected : null]}>
            RiderGuy review feedback
          </Text>
          <Text style={styles.reviewText}>{interest.reviewNotes}</Text>
          {interest.reviewedAt ? (
            <Text style={styles.reviewDate}>Reviewed {formatRequestDate(interest.reviewedAt)}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function LockedRegistrationCard({
  hasActiveInterest,
  interestError,
  interestLoading,
  trainingStatus,
  verifiedEmail,
  onRetryInterest,
}: {
  hasActiveInterest: boolean;
  interestError: boolean;
  interestLoading: boolean;
  trainingStatus: TrainingStatus;
  verifiedEmail: string | null;
  onRetryInterest: () => void;
}) {
  let body = 'Registration opens when your live account checks are complete.';
  let buttonLabel: string | null = null;
  let buttonIcon: keyof typeof Ionicons.glyphMap = 'arrow-forward';
  let onPress: (() => void) | undefined;

  if (hasActiveInterest) {
    body =
      'Your current request is already registered. Its live status and review feedback appear above.';
  } else if (interestError) {
    body = 'Retry the request-status check before registering.';
    buttonLabel = 'Retry status check';
    buttonIcon = 'refresh';
    onPress = onRetryInterest;
  } else if (interestLoading) {
    body = 'Checking whether you already have a request.';
  } else if (!trainingStatus.eligible) {
    body = trainingStatus.message;
    buttonLabel =
      trainingStatus.status === 'PENDING' && trainingStatus.label === 'Status unavailable'
        ? null
        : 'Open training';
    buttonIcon = 'school-outline';
    onPress = buttonLabel ? () => router.push('/(app)/training') : undefined;
  } else if (!verifiedEmail) {
    body = 'Add and verify your RiderGuy account email before registering interest.';
    buttonLabel = 'Manage profile';
    buttonIcon = 'person-circle-outline';
    onPress = () => router.push('/(app)/settings/profile');
  }

  return (
    <View style={styles.lockedCard}>
      <View style={styles.lockedIcon}>
        <Ionicons
          name={hasActiveInterest ? 'time-outline' : 'lock-closed-outline'}
          size={22}
          color="#168C58"
        />
      </View>
      <View style={styles.lockedCopy}>
        <Text style={styles.lockedTitle}>
          {hasActiveInterest ? 'Request already registered' : 'Interest registration is locked'}
        </Text>
        <Text style={styles.lockedBody}>{body}</Text>
      </View>
      {buttonLabel && onPress ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
          activeOpacity={0.84}
          onPress={onPress}
          style={styles.lockedButton}
        >
          <Ionicons name={buttonIcon} size={16} color="#168C58" />
          <Text style={styles.lockedButtonText}>{buttonLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function QuickAction({
  icon,
  title,
  body,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      activeOpacity={0.84}
      onPress={onPress}
      style={styles.quickAction}
    >
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon} size={20} color="#168C58" />
      </View>
      <View style={styles.quickActionCopy}>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionBody}>{body}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color="#929996" />
    </TouchableOpacity>
  );
}

function AssetBottomNavigation({ onActivePress }: { onActivePress: () => void }) {
  const items: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    route?: string;
  }[] = [
    { label: 'Home', icon: 'home-outline', route: '/(tabs)' },
    { label: 'Deliveries', icon: 'bicycle-outline', route: '/(tabs)/jobs' },
    { label: 'Earnings', icon: 'wallet-outline', route: '/(tabs)/earnings' },
    { label: 'Asset Financing', icon: 'key-outline' },
    { label: 'Profile', icon: 'person-outline', route: '/(tabs)/account' },
  ];

  return (
    <View style={styles.bottomNav} accessibilityRole="tablist">
      {items.map((item) => {
        const active = !item.route;
        return (
          <TouchableOpacity
            key={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            activeOpacity={0.82}
            onPress={() => (item.route ? router.replace(item.route as any) : onActivePress())}
            style={styles.bottomNavItem}
          >
            {active ? (
              <MaterialCommunityIcons name="motorbike-electric" size={23} color="#168C58" />
            ) : (
              <Ionicons name={item.icon} size={22} color="#848B87" />
            )}
            <Text
              style={[styles.bottomNavLabel, active ? styles.bottomNavLabelActive : null]}
              numberOfLines={1}
            >
              {active ? 'Assets' : item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: riderColors.white,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  pageHeading: {
    paddingTop: 7,
    paddingBottom: 15,
  },
  pageTitle: {
    color: '#080A09',
    fontSize: 27,
    lineHeight: 33,
    fontFamily: riderFonts.extrabold,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    color: '#69716D',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: riderFonts.regular,
    marginTop: 3,
  },
  heroCard: {
    minHeight: 260,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDEAE3',
    backgroundColor: '#F7FCF9',
    overflow: 'hidden',
    padding: 16,
    ...riderShadow,
  },
  heroHalo: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    right: -42,
    top: 34,
    backgroundColor: '#E5F6ED',
  },
  calendarBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 50,
    height: 48,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#BDE8D1',
    backgroundColor: '#EDF9F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNumber: {
    color: '#168C58',
    fontSize: 16,
    lineHeight: 18,
    fontFamily: riderFonts.extrabold,
    fontWeight: '900',
  },
  heroTitle: {
    color: '#168C58',
    fontSize: 20,
    lineHeight: 25,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
    maxWidth: '78%',
  },
  heroBody: {
    color: '#111814',
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: riderFonts.medium,
    fontWeight: '600',
    maxWidth: '61%',
    marginTop: 6,
  },
  heroBenefitList: {
    gap: 7,
    marginTop: 13,
    maxWidth: '59%',
  },
  heroBenefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroBenefitIcon: {
    width: 25,
    height: 25,
    borderRadius: 9,
    backgroundColor: '#E2F5EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBenefitText: {
    flex: 1,
    color: '#2F3733',
    fontSize: 10.5,
    lineHeight: 14,
    fontFamily: riderFonts.medium,
    fontWeight: '600',
  },
  heroArt: {
    position: 'absolute',
    width: 215,
    height: 112,
    right: -24,
    top: 79,
  },
  heroButton: {
    alignSelf: 'flex-start',
    minHeight: 42,
    borderRadius: 9,
    backgroundColor: '#1E9D62',
    paddingHorizontal: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  heroButtonText: {
    color: riderColors.white,
    fontSize: 11.5,
    fontFamily: riderFonts.bold,
    fontWeight: '800',
  },
  sectionHeading: {
    minHeight: 34,
    marginTop: 19,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    flex: 1,
    color: '#080A09',
    fontSize: 17,
    lineHeight: 23,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  sectionAction: {
    color: '#168C58',
    fontSize: 10.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '700',
  },
  sectionIntro: {
    color: '#707874',
    fontSize: 10.5,
    lineHeight: 15,
    fontFamily: riderFonts.regular,
    marginBottom: 9,
  },
  benefitRail: {
    gap: 9,
    paddingVertical: 2,
    paddingRight: 10,
  },
  benefitCard: {
    width: 128,
    minHeight: 139,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E5ECE8',
    backgroundColor: riderColors.white,
    padding: 12,
    alignItems: 'center',
    ...riderShadow,
  },
  benefitIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#EDF9F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTitle: {
    color: '#111814',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    fontFamily: riderFonts.bold,
    fontWeight: '800',
    marginTop: 9,
  },
  benefitBody: {
    color: '#6C746F',
    fontSize: 9.5,
    lineHeight: 14,
    textAlign: 'center',
    fontFamily: riderFonts.regular,
    marginTop: 4,
  },
  assetRail: {
    gap: 11,
    paddingVertical: 2,
    paddingRight: 10,
  },
  assetCard: {
    width: 226,
    minHeight: 268,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3EAE6',
    backgroundColor: riderColors.white,
    padding: 13,
    ...riderShadow,
  },
  assetCardSelected: {
    borderColor: '#4BC38A',
    backgroundColor: '#FCFEFD',
  },
  assetCardDisabled: {
    opacity: 0.58,
  },
  assetCardTopRow: {
    minHeight: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assetTag: {
    minHeight: 23,
    borderRadius: 7,
    backgroundColor: '#F0F4F2',
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetTagSelected: {
    backgroundColor: '#DFF4E9',
  },
  assetTagText: {
    color: '#6B726E',
    fontSize: 9.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '700',
  },
  assetTagTextSelected: {
    color: '#168C58',
  },
  assetIllustration: {
    height: 94,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    overflow: 'hidden',
  },
  assetIllustrationHalo: {
    position: 'absolute',
    width: 114,
    height: 74,
    borderRadius: 40,
    backgroundColor: '#E9F8F0',
  },
  assetProductImage: {
    width: 190,
    height: 91,
  },
  assetTitle: {
    color: '#0A0D0B',
    fontSize: 14,
    lineHeight: 19,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
  },
  assetBody: {
    color: '#69716D',
    fontSize: 10.5,
    lineHeight: 15,
    fontFamily: riderFonts.regular,
    marginTop: 4,
    minHeight: 46,
  },
  assetChoiceButton: {
    minHeight: 38,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#F7FAF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 9,
  },
  assetChoiceButtonSelected: {
    borderColor: '#1E9D62',
    backgroundColor: '#1E9D62',
  },
  assetChoiceText: {
    color: '#454C48',
    fontSize: 10.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '700',
  },
  assetChoiceTextSelected: {
    color: riderColors.white,
  },
  stepsCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5ECE8',
    backgroundColor: riderColors.white,
    padding: 14,
    ...riderShadow,
  },
  stepRow: {
    minHeight: 74,
    flexDirection: 'row',
    gap: 12,
  },
  stepRail: {
    width: 38,
    alignItems: 'center',
  },
  stepIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#E8F7EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: {
    flex: 1,
    width: 1,
    backgroundColor: '#D5EAE0',
    marginVertical: 4,
  },
  stepCopy: {
    flex: 1,
    paddingBottom: 14,
  },
  stepEyebrow: {
    color: '#168C58',
    fontSize: 8.5,
    lineHeight: 12,
    letterSpacing: 0.7,
    fontFamily: riderFonts.bold,
    fontWeight: '800',
  },
  stepTitle: {
    color: '#111814',
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: riderFonts.bold,
    fontWeight: '800',
    marginTop: 1,
  },
  stepBody: {
    color: '#6B736F',
    fontSize: 10.5,
    lineHeight: 15,
    fontFamily: riderFonts.regular,
    marginTop: 2,
  },
  statusCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2EAE5',
    backgroundColor: riderColors.white,
    padding: 15,
    ...riderShadow,
  },
  statusMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  statusMessageIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#E8F7EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusMessageIconWarning: {
    backgroundColor: riderColors.amberSoft,
  },
  statusHeadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  statusHeadingCopy: {
    flex: 1,
    minWidth: 0,
  },
  statusTitle: {
    color: '#111814',
    fontSize: 14,
    lineHeight: 19,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
  },
  statusBody: {
    color: '#68706C',
    fontSize: 10.5,
    lineHeight: 16,
    fontFamily: riderFonts.regular,
    marginTop: 3,
  },
  cardButton: {
    marginTop: 13,
  },
  requestAsset: {
    color: '#111814',
    fontSize: 15,
    lineHeight: 20,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
  },
  requestDate: {
    color: '#7A827E',
    fontSize: 10,
    lineHeight: 14,
    fontFamily: riderFonts.regular,
    marginTop: 2,
  },
  requestMessage: {
    color: '#56605A',
    fontSize: 11,
    lineHeight: 17,
    fontFamily: riderFonts.regular,
    marginTop: 12,
  },
  progressBlock: {
    marginTop: 14,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  progressLabel: {
    color: '#5C6560',
    fontSize: 10,
    fontFamily: riderFonts.medium,
    fontWeight: '600',
  },
  progressValue: {
    color: '#168C58',
    fontSize: 10,
    fontFamily: riderFonts.bold,
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E7EBE9',
    overflow: 'hidden',
    marginTop: 7,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#1EAD6B',
  },
  progressFillRejected: {
    backgroundColor: '#D9584B',
  },
  reviewBox: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#BDE8D1',
    backgroundColor: '#EFFAF4',
    padding: 11,
    marginTop: 13,
  },
  reviewBoxRejected: {
    borderColor: '#F3C6C2',
    backgroundColor: '#FFF1F0',
  },
  reviewLabel: {
    color: '#168C58',
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily: riderFonts.bold,
    fontWeight: '800',
  },
  reviewLabelRejected: {
    color: '#A42C24',
  },
  reviewText: {
    color: '#26302A',
    fontSize: 10.5,
    lineHeight: 16,
    fontFamily: riderFonts.regular,
    marginTop: 3,
  },
  reviewDate: {
    color: '#7C847F',
    fontSize: 9,
    fontFamily: riderFonts.medium,
    marginTop: 6,
  },
  emailRow: {
    minHeight: 48,
    borderRadius: 11,
    backgroundColor: '#F4FAF7',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 13,
  },
  emailCopy: {
    flex: 1,
    minWidth: 0,
  },
  emailLabel: {
    color: '#7A827E',
    fontSize: 8.5,
    lineHeight: 12,
    textTransform: 'uppercase',
    fontFamily: riderFonts.semibold,
    fontWeight: '700',
  },
  emailValue: {
    color: '#1B2520',
    fontSize: 10.5,
    lineHeight: 15,
    fontFamily: riderFonts.semibold,
    fontWeight: '700',
    marginTop: 1,
  },
  emailWarning: {
    minHeight: 48,
    borderRadius: 11,
    backgroundColor: '#FFF7E8',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 13,
  },
  emailWarningText: {
    flex: 1,
    color: '#79500E',
    fontSize: 10.5,
    lineHeight: 15,
    fontFamily: riderFonts.medium,
    fontWeight: '600',
  },
  registrationCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CFE8DB',
    backgroundColor: '#FAFDFC',
    padding: 15,
    marginTop: 13,
    ...riderShadow,
  },
  registrationHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    marginBottom: 14,
  },
  registrationIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#E5F6ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registrationCopy: {
    flex: 1,
  },
  registrationTitle: {
    color: '#111814',
    fontSize: 14,
    lineHeight: 19,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
  },
  registrationBody: {
    color: '#68706C',
    fontSize: 10.5,
    lineHeight: 16,
    fontFamily: riderFonts.regular,
    marginTop: 2,
  },
  fieldLabel: {
    color: '#28312C',
    fontSize: 10.5,
    lineHeight: 15,
    fontFamily: riderFonts.semibold,
    fontWeight: '700',
    marginBottom: 7,
  },
  notesInput: {
    minHeight: 92,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#DDE7E2',
    backgroundColor: riderColors.white,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#111814',
    fontSize: 11.5,
    lineHeight: 17,
    fontFamily: riderFonts.regular,
  },
  selectionSummary: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: '#EAF8F1',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  selectionSummaryText: {
    flex: 1,
    color: '#1D533A',
    fontSize: 10.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '700',
  },
  submitButton: {
    minHeight: 48,
    borderRadius: 10,
    marginTop: 12,
    backgroundColor: '#1E9D62',
  },
  disclosure: {
    color: '#818985',
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
    fontFamily: riderFonts.regular,
    marginTop: 9,
  },
  lockedCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E1E9E5',
    backgroundColor: '#F8FBF9',
    padding: 14,
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  lockedIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#E7F6EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedCopy: {
    flex: 1,
  },
  lockedTitle: {
    color: '#18211C',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: riderFonts.bold,
    fontWeight: '800',
  },
  lockedBody: {
    color: '#69716D',
    fontSize: 10,
    lineHeight: 15,
    fontFamily: riderFonts.regular,
    marginTop: 3,
  },
  lockedButton: {
    minHeight: 35,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#CCE7D9',
    backgroundColor: riderColors.white,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  lockedButtonText: {
    color: '#168C58',
    fontSize: 9.5,
    fontFamily: riderFonts.bold,
    fontWeight: '800',
  },
  quickActions: {
    gap: 8,
  },
  quickAction: {
    minHeight: 62,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E4EBE7',
    backgroundColor: riderColors.white,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...riderShadow,
  },
  quickActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E9F8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionCopy: {
    flex: 1,
  },
  quickActionTitle: {
    color: '#121815',
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: riderFonts.bold,
    fontWeight: '800',
  },
  quickActionBody: {
    color: '#727975',
    fontSize: 9.5,
    lineHeight: 14,
    fontFamily: riderFonts.regular,
    marginTop: 1,
  },
  footerDisclosure: {
    color: '#8A918D',
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
    fontFamily: riderFonts.regular,
    paddingHorizontal: 10,
    marginTop: 18,
  },
  bottomNav: {
    minHeight: 66,
    borderTopWidth: 1,
    borderTopColor: '#E9EEEB',
    backgroundColor: riderColors.white,
    paddingTop: 7,
    flexDirection: 'row',
  },
  bottomNavItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bottomNavLabel: {
    maxWidth: '100%',
    color: '#848B87',
    fontSize: 8.5,
    lineHeight: 12,
    fontFamily: riderFonts.medium,
    fontWeight: '600',
  },
  bottomNavLabelActive: {
    color: '#168C58',
    fontFamily: riderFonts.bold,
    fontWeight: '800',
  },
});
