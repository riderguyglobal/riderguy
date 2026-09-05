import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@riderguy/auth-native';
import { BrandHeader, RiderButton, RiderTextField } from '@/components/rider-ui';
import { RiderNavigationMenu } from '@/components/rider-navigation-menu';
import { RiderBottomNavigation } from '@/components/rider-bottom-navigation';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { riderColors, riderFonts, riderShadow } from '@/lib/rider-design';

type IconName = keyof typeof Ionicons.glyphMap;

const safetyHeroArt = require('../../assets/images/illustrations/rider-safety-shield-v1.png');

const REPORT_TYPES = [
  'Delivery safety concern',
  'Road incident',
  'Vehicle safety',
  'Threat or harassment',
] as const;

type ReportType = (typeof REPORT_TYPES)[number];
type ChecklistKey = 'gear' | 'vehicle' | 'phone' | 'cargo';
type GuidanceAction = 'training' | 'emergency' | 'support' | 'community';

const CHECKLIST_ITEMS: {
  key: ChecklistKey;
  icon: IconName;
  title: string;
  detail: string;
}[] = [
  {
    key: 'gear',
    icon: 'shield-checkmark-outline',
    title: 'Helmet & safety gear',
    detail: 'Helmet fastened and reflective gear visible',
  },
  {
    key: 'vehicle',
    icon: 'construct-outline',
    title: 'Tyres, brakes & lights',
    detail: 'Vehicle checked before going online',
  },
  {
    key: 'phone',
    icon: 'phone-portrait-outline',
    title: 'Phone ready',
    detail: 'Charged, mounted and route audio enabled',
  },
  {
    key: 'cargo',
    icon: 'briefcase-outline',
    title: 'Delivery bag secured',
    detail: 'Bag closed and load balanced safely',
  },
];

const GUIDANCE_ITEMS: {
  id: string;
  icon: IconName;
  title: string;
  intro: string;
  points: string[];
  action: GuidanceAction;
  actionLabel: string;
}[] = [
  {
    id: 'safe-riding',
    icon: 'shield-outline',
    title: 'Safe Riding Tips',
    intro: 'Small habits protect you, the customer and every road user.',
    points: [
      'Obey speed limits and leave extra stopping distance in rain or traffic.',
      'Stop in a safe place before checking directions or replying to a message.',
      'Use reflective gear and working lights whenever visibility is low.',
      'Never continue a delivery when you feel tired, unwell or unsafe.',
    ],
    action: 'training',
    actionLabel: 'Open safety training',
  },
  {
    id: 'accident',
    icon: 'document-text-outline',
    title: 'Accident Procedure',
    intro: 'Your immediate safety comes before the parcel or the delivery time.',
    points: [
      'Move away from moving traffic if you can do so without causing more harm.',
      'Call 112 for urgent medical, fire or police assistance in Ghana.',
      'Do not admit fault or argue. Record the location and relevant details safely.',
      'Send RiderGuy a report with the order number once the immediate danger is handled.',
    ],
    action: 'emergency',
    actionLabel: 'Emergency options',
  },
  {
    id: 'coverage',
    icon: 'umbrella-outline',
    title: 'Insurance & Coverage',
    intro: 'Coverage varies by vehicle, rider arrangement and insurance provider.',
    points: [
      'Keep your licence, roadworthy documents and insurance information current.',
      'Photograph damage only after moving to a safe place.',
      'Keep receipts and reference numbers supplied by police, medical or repair services.',
      'Ask RiderGuy support which documents are needed for your specific incident.',
    ],
    action: 'support',
    actionLabel: 'Ask safety support',
  },
  {
    id: 'community',
    icon: 'people-outline',
    title: 'Community Safety Updates',
    intro: 'Learn from RiderGuy announcements and other riders without sharing private trip data.',
    points: [
      'Check official notices before riding during severe weather or major road closures.',
      'Avoid posting customer names, phone numbers, addresses or order screenshots.',
      'Report threatening or unsafe community content through the in-app report action.',
    ],
    action: 'community',
    actionLabel: 'Open rider community',
  },
];

const LOCATION_TIMEOUT_MS = 12_000;
const LAST_KNOWN_MAX_AGE_MS = 2 * 60 * 1000;
const LAST_KNOWN_MAX_ACCURACY_METERS = 250;

async function getShareablePosition() {
  const current = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS)),
  ]);

  if (
    current &&
    Number.isFinite(current.coords.latitude) &&
    Number.isFinite(current.coords.longitude)
  ) {
    return current;
  }

  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: LAST_KNOWN_MAX_AGE_MS,
    requiredAccuracy: LAST_KNOWN_MAX_ACCURACY_METERS,
  }).catch(() => null);

  if (
    lastKnown &&
    Number.isFinite(lastKnown.coords.latitude) &&
    Number.isFinite(lastKnown.coords.longitude)
  ) {
    return lastKnown;
  }

  return null;
}

export default function SafetyCenterScreen() {
  const { api, user } = useAuth();
  const { unreadCount } = useUnreadNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('Delivery safety concern');
  const [email, setEmail] = useState(user?.email ?? '');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [guidanceId, setGuidanceId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<ChecklistKey, boolean>>({
    gear: false,
    vehicle: false,
    phone: false,
    cargo: false,
  });

  useEffect(() => {
    setEmail((current) => current || user?.email || '');
  }, [user?.email]);

  const completedChecks = Object.values(checklist).filter(Boolean).length;
  const selectedGuidance = GUIDANCE_ITEMS.find((item) => item.id === guidanceId) ?? null;

  const openReport = (type: ReportType = 'Delivery safety concern') => {
    setReportType(type);
    setReportOpen(true);
  };

  const openEmailSupport = async (subject = 'RiderGuy Rider Safety Support') => {
    try {
      await Linking.openURL(`mailto:hello@myriderguy.com?subject=${encodeURIComponent(subject)}`);
    } catch {
      Alert.alert(
        'Email app unavailable',
        'Email RiderGuy safety support at hello@myriderguy.com.',
      );
    }
  };

  const callEmergencyServices = () => {
    Alert.alert(
      'Call emergency services?',
      'Use this only for an urgent safety, police, fire or medical emergency in Ghana.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call 112',
          style: 'destructive',
          onPress: () => {
            void Linking.openURL('tel:112').catch(() => {
              Alert.alert('Could not open the phone', 'Dial 112 from your phone keypad.');
            });
          },
        },
      ],
    );
  };

  const shareCurrentLocation = async () => {
    if (sharingLocation) return;

    setSharingLocation(true);
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (permission.status !== 'granted') {
        Alert.alert(
          'Location permission needed',
          'Allow foreground location to share a one-time safety check-in. RiderGuy will not start background tracking from this action.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open settings', onPress: () => void Linking.openSettings() },
          ],
        );
        return;
      }

      const position = await getShareablePosition();
      if (!position) {
        Alert.alert(
          'Location unavailable',
          'Move to an open, safe place and try again. You can still send a check-in without a location from Trusted Contacts.',
        );
        return;
      }

      const latitude = position.coords.latitude.toFixed(6);
      const longitude = position.coords.longitude.toFixed(6);
      const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
      const riderName = user?.firstName?.trim() || 'A RiderGuy rider';

      await Share.share({
        title: 'RiderGuy safety check-in',
        message: `${riderName} shared a one-time trip safety location. This is not continuous live tracking.\n${mapUrl}`,
      });
    } catch {
      Alert.alert(
        'Could not share location',
        'Check that location services are on, then try again from a safe place.',
      );
    } finally {
      setSharingLocation(false);
    }
  };

  const openTrustedContacts = () => {
    Alert.alert(
      'Share a safety check-in',
      'RiderGuy does not read or upload your contacts. Use your phone share sheet to choose someone you trust.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share check-in',
          onPress: () => {
            void Share.share({
              title: 'RiderGuy safety check-in',
              message:
                'I am checking in during a RiderGuy trip. Please keep your phone nearby in case I need help.',
            }).catch(() => {
              Alert.alert('Sharing unavailable', 'Open your Contacts or Messages app to check in.');
            });
          },
        },
      ],
    );
  };

  const openRoadsideHelp = () => {
    Alert.alert(
      'Roadside guidance',
      'Move yourself and the vehicle away from traffic if it is safe. For immediate danger call 112. You can send RiderGuy Support a non-emergency message for follow-up.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Email support',
          onPress: () => void openEmailSupport('RiderGuy roadside assistance'),
        },
        { text: 'Report issue', onPress: () => openReport('Vehicle safety') },
      ],
    );
  };

  const submitSafetyReport = async () => {
    const contactEmail = email.trim();
    if (!contactEmail.includes('@')) {
      Alert.alert('Email required', 'Enter a valid email so RiderGuy can follow up safely.');
      return;
    }
    if (details.trim().length < 10) {
      Alert.alert('Add more detail', 'Describe what happened in at least 10 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/riders/safety-support', {
        category: reportType,
        followUpEmail: contactEmail,
        details: details.trim(),
      });
      setReportOpen(false);
      setDetails('');
      Alert.alert(
        'Safety report sent',
        'RiderGuy Support received your non-emergency message. Call 112 separately for immediate danger.',
      );
    } catch (error: any) {
      Alert.alert(
        'Could not send report',
        error?.response?.data?.error?.message ??
          'Please retry or use the email option if your connection remains unavailable.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const runGuidanceAction = (action: GuidanceAction) => {
    setGuidanceId(null);

    if (action === 'training') {
      router.push('/(app)/training');
      return;
    }
    if (action === 'community') {
      router.push('/(tabs)/community');
      return;
    }
    if (action === 'emergency') {
      setTimeout(callEmergencyServices, 220);
      return;
    }

    setTimeout(() => openReport('Delivery safety concern'), 220);
  };

  const resetChecklist = () => {
    setChecklist({ gear: false, vehicle: false, phone: false, cargo: false });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BrandHeader
        onMenu={() => setMenuOpen(true)}
        onNotifications={() => router.push('/(app)/notifications')}
        unread={unreadCount > 0}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeading}>
          <Text style={styles.pageTitle}>Safety Center</Text>
          <Text style={styles.pageSubtitle}>
            Stay protected before, during, and after every delivery.
          </Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroVisual}>
            <Image source={safetyHeroArt} resizeMode="contain" style={styles.heroArtwork} />
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Safety tools in one place.</Text>
            <View style={styles.readyPill}>
              <Ionicons name="shield-checkmark" size={17} color={riderColors.greenDark} />
              <Text style={styles.readyPillText}>Emergency and support options</Text>
            </View>
            <Text style={styles.heroBody}>
              Call 112 for immediate danger or send RiderGuy a non-emergency support message.
            </Text>

            <View style={styles.heroActions}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Call Ghana emergency services on 112"
                activeOpacity={0.84}
                onPress={callEmergencyServices}
                style={[styles.heroButton, styles.heroButtonPrimary]}
              >
                <Ionicons name="alert-circle" size={18} color={riderColors.white} />
                <Text style={styles.heroButtonPrimaryText}>Call 112</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Open RiderGuy safety support report"
                activeOpacity={0.84}
                onPress={() => openReport()}
                style={[styles.heroButton, styles.heroButtonSecondary]}
              >
                <Ionicons name="headset-outline" size={18} color={riderColors.greenDark} />
                <Text style={styles.heroButtonSecondaryText}>Get support</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quick Safety Actions</Text>
        <View style={styles.quickActionsRow}>
          <QuickAction
            icon="navigate-outline"
            title="Share Location"
            body="Send a one-time location"
            loading={sharingLocation}
            onPress={() => void shareCurrentLocation()}
          />
          <QuickAction
            icon="people-outline"
            title="Share Check-in"
            body="Message someone you trust"
            onPress={openTrustedContacts}
          />
          <QuickAction
            icon="warning-outline"
            title="Contact Support"
            body="Send a non-emergency report"
            onPress={() => openReport('Road incident')}
          />
          <QuickAction
            icon="car-outline"
            title="Roadside Guidance"
            body="Steps for a breakdown"
            onPress={openRoadsideHelp}
          />
        </View>

        <View style={styles.checklistCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Safety Checklist</Text>
              <Text style={styles.cardSubtitle}>
                {completedChecks} of 4 confirmed for this session
              </Text>
            </View>
            {completedChecks > 0 ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Reset safety checklist"
                activeOpacity={0.8}
                onPress={resetChecklist}
                style={styles.headerAction}
              >
                <Text style={styles.headerActionText}>Reset</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.headerHint}>Tap to check</Text>
            )}
          </View>

          {CHECKLIST_ITEMS.map((item, index) => {
            const checked = checklist[item.key];
            return (
              <TouchableOpacity
                key={item.key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={`${item.title}. ${item.detail}`}
                activeOpacity={0.8}
                onPress={() =>
                  setChecklist((current) => ({ ...current, [item.key]: !current[item.key] }))
                }
                style={[
                  styles.checklistRow,
                  index === CHECKLIST_ITEMS.length - 1 && styles.lastRow,
                ]}
              >
                <View style={[styles.rowIcon, checked && styles.rowIconChecked]}>
                  <Ionicons
                    name={checked ? 'checkmark' : item.icon}
                    size={20}
                    color={riderColors.greenDark}
                  />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowDetail} numberOfLines={1}>
                    {item.detail}
                  </Text>
                </View>
                <View style={[styles.checkPill, checked && styles.checkPillDone]}>
                  {checked ? (
                    <Ionicons name="checkmark" size={14} color={riderColors.greenDark} />
                  ) : null}
                  <Text style={[styles.checkPillText, checked && styles.checkPillTextDone]}>
                    {checked ? 'Done' : 'Check'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Resources &amp; Guidance</Text>
        <View style={styles.resourcesCard}>
          {GUIDANCE_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.title}`}
              activeOpacity={0.8}
              onPress={() => setGuidanceId(item.id)}
              style={[styles.resourceRow, index === GUIDANCE_ITEMS.length - 1 && styles.lastRow]}
            >
              <View style={styles.resourceIcon}>
                <Ionicons name={item.icon} size={21} color={riderColors.greenDark} />
              </View>
              <Text style={styles.resourceTitle}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={19} color={riderColors.muted} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.supportBand}>
          <View style={styles.supportIcon}>
            <Ionicons name="headset" size={27} color={riderColors.white} />
          </View>
          <View style={styles.supportCopy}>
            <Text style={styles.supportTitle}>Need follow-up support?</Text>
            <Text style={styles.supportBody}>
              Send a non-emergency message to RiderGuy Support.
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open help and support report"
            activeOpacity={0.84}
            onPress={() => openReport()}
            style={styles.supportButton}
          >
            <Text style={styles.supportButtonText}>Open support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <RiderBottomNavigation />

      <Modal
        visible={reportOpen}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => {
          if (!submitting) setReportOpen(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalFlex}
        >
          <SafeAreaView style={styles.modalBackdrop} edges={['bottom']}>
            <View style={styles.reportSheet}>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetTitleWrap}>
                  <Text style={styles.sheetTitle}>Contact RiderGuy Support</Text>
                  <Text style={styles.sheetSubtitle}>
                    Non-emergency message sent to the RiderGuy support inbox
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Close safety report"
                  onPress={() => setReportOpen(false)}
                  disabled={submitting}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={22} color={riderColors.ink} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Report category</Text>
                <View style={styles.categoryWrap}>
                  {REPORT_TYPES.map((type) => {
                    const selected = reportType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        onPress={() => setReportType(type)}
                        activeOpacity={0.8}
                        style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                      >
                        <Text
                          style={[styles.categoryText, selected && styles.categoryTextSelected]}
                        >
                          {type}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <RiderTextField
                  label="Follow-up email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <RiderTextField
                  label="What happened?"
                  value={details}
                  onChangeText={setDetails}
                  placeholder="Include the order number, place, time, and the immediate help you need."
                  multiline
                  inputStyle={styles.detailsInput}
                />
                <RiderButton
                  label="Send support message"
                  icon="shield-checkmark-outline"
                  loading={submitting}
                  disabled={!email.trim() || details.trim().length < 10}
                  onPress={submitSafetyReport}
                />
                <RiderButton
                  label="Use Email Instead"
                  icon="mail-outline"
                  variant="ghost"
                  disabled={submitting}
                  onPress={() => void openEmailSupport()}
                  style={styles.emailButton}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Call Ghana emergency services"
                  activeOpacity={0.8}
                  onPress={callEmergencyServices}
                  style={styles.emergencyReminder}
                >
                  <Ionicons name="call-outline" size={18} color={riderColors.red} />
                  <Text style={styles.emergencyReminderText}>
                    Immediate danger? Call Ghana emergency services on 112.
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={Boolean(selectedGuidance)}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setGuidanceId(null)}
      >
        <SafeAreaView style={styles.modalBackdrop} edges={['bottom']}>
          {selectedGuidance ? (
            <View style={styles.guidanceSheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.guidanceHeading}>
                <View style={styles.guidanceIcon}>
                  <Ionicons name={selectedGuidance.icon} size={27} color={riderColors.greenDark} />
                </View>
                <View style={styles.sheetTitleWrap}>
                  <Text style={styles.sheetTitle}>{selectedGuidance.title}</Text>
                  <Text style={styles.sheetSubtitle}>{selectedGuidance.intro}</Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Close ${selectedGuidance.title}`}
                  activeOpacity={0.8}
                  onPress={() => setGuidanceId(null)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={22} color={riderColors.ink} />
                </TouchableOpacity>
              </View>

              <View style={styles.guidancePoints}>
                {selectedGuidance.points.map((point) => (
                  <View key={point} style={styles.guidancePoint}>
                    <View style={styles.guidanceBullet}>
                      <Ionicons name="checkmark" size={14} color={riderColors.white} />
                    </View>
                    <Text style={styles.guidancePointText}>{point}</Text>
                  </View>
                ))}
              </View>

              <RiderButton
                label={selectedGuidance.actionLabel}
                icon="arrow-forward"
                onPress={() => runGuidanceAction(selectedGuidance.action)}
              />
              <RiderButton
                label="Close"
                variant="ghost"
                onPress={() => setGuidanceId(null)}
                style={styles.emailButton}
              />
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>

      <RiderNavigationMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </SafeAreaView>
  );
}

function QuickAction({
  body,
  icon,
  loading,
  onPress,
  title,
}: {
  body: string;
  icon: IconName;
  loading?: boolean;
  onPress: () => void;
  title: string;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      accessibilityState={{ busy: Boolean(loading), disabled: Boolean(loading) }}
      activeOpacity={0.82}
      disabled={loading}
      onPress={onPress}
      style={styles.quickAction}
    >
      <View style={styles.quickActionIcon}>
        {loading ? (
          <ActivityIndicator size="small" color={riderColors.greenDark} />
        ) : (
          <Ionicons name={icon} size={27} color={riderColors.greenDark} />
        )}
      </View>
      <Text style={styles.quickActionTitle} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.quickActionBody} numberOfLines={3}>
        {body}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: riderColors.white,
  },
  scroll: {
    flex: 1,
    backgroundColor: riderColors.white,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 34,
  },
  pageHeading: {
    marginBottom: 14,
  },
  pageTitle: {
    color: riderColors.ink,
    fontFamily: riderFonts.bold,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  pageSubtitle: {
    color: riderColors.muted,
    fontFamily: riderFonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },
  heroCard: {
    minHeight: 204,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D9ECE3',
    backgroundColor: riderColors.greenMist,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    marginBottom: 20,
    ...riderShadow,
  },
  heroVisual: {
    width: 112,
    height: 158,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroArtwork: {
    width: 132,
    height: 146,
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    color: riderColors.ink,
    fontFamily: riderFonts.bold,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  readyPill: {
    alignSelf: 'flex-start',
    minHeight: 29,
    borderRadius: 10,
    backgroundColor: '#DCF4E8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    marginTop: 7,
  },
  readyPillText: {
    color: riderColors.greenDark,
    fontFamily: riderFonts.semibold,
    fontSize: 11,
    fontWeight: '800',
  },
  heroBody: {
    color: riderColors.muted,
    fontFamily: riderFonts.regular,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 7,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 12,
  },
  heroButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
  },
  heroButtonPrimary: {
    backgroundColor: riderColors.greenDark,
  },
  heroButtonSecondary: {
    backgroundColor: riderColors.white,
    borderWidth: 1.5,
    borderColor: riderColors.greenDark,
  },
  heroButtonPrimaryText: {
    color: riderColors.white,
    fontFamily: riderFonts.semibold,
    fontSize: 11.5,
    fontWeight: '900',
  },
  heroButtonSecondaryText: {
    color: riderColors.greenDark,
    fontFamily: riderFonts.semibold,
    fontSize: 10.5,
    fontWeight: '900',
  },
  sectionTitle: {
    color: riderColors.ink,
    fontFamily: riderFonts.bold,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 20,
  },
  quickAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 142,
    borderRadius: 18,
    backgroundColor: riderColors.white,
    borderWidth: 1,
    borderColor: riderColors.line,
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingTop: 12,
    paddingBottom: 9,
    ...riderShadow,
  },
  quickActionIcon: {
    width: 49,
    height: 49,
    borderRadius: 25,
    backgroundColor: riderColors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionTitle: {
    color: riderColors.ink,
    fontFamily: riderFonts.semibold,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  quickActionBody: {
    color: riderColors.muted,
    fontFamily: riderFonts.regular,
    fontSize: 8.5,
    lineHeight: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  checklistCard: {
    borderRadius: 20,
    backgroundColor: riderColors.white,
    borderWidth: 1,
    borderColor: riderColors.line,
    paddingHorizontal: 14,
    paddingTop: 13,
    marginBottom: 20,
    ...riderShadow,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  cardTitle: {
    color: riderColors.ink,
    fontFamily: riderFonts.bold,
    fontSize: 17,
    fontWeight: '900',
  },
  cardSubtitle: {
    color: riderColors.muted,
    fontFamily: riderFonts.regular,
    fontSize: 9.5,
    marginTop: 1,
  },
  headerAction: {
    minHeight: 36,
    minWidth: 54,
    borderRadius: 12,
    backgroundColor: riderColors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  headerActionText: {
    color: riderColors.greenDark,
    fontFamily: riderFonts.semibold,
    fontSize: 11,
    fontWeight: '800',
  },
  headerHint: {
    color: riderColors.greenDark,
    fontFamily: riderFonts.medium,
    fontSize: 10.5,
  },
  checklistRow: {
    minHeight: 66,
    borderBottomWidth: 1,
    borderBottomColor: riderColors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: riderColors.greenMist,
    borderWidth: 1,
    borderColor: riderColors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconChecked: {
    backgroundColor: riderColors.greenSoft,
    borderColor: '#B9E9D2',
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: riderColors.ink,
    fontFamily: riderFonts.medium,
    fontSize: 12,
    fontWeight: '700',
  },
  rowDetail: {
    color: riderColors.muted,
    fontFamily: riderFonts.regular,
    fontSize: 8.5,
    marginTop: 2,
  },
  checkPill: {
    minWidth: 57,
    minHeight: 30,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: riderColors.line,
    backgroundColor: riderColors.panelAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 7,
  },
  checkPillDone: {
    backgroundColor: riderColors.greenSoft,
    borderColor: 'transparent',
  },
  checkPillText: {
    color: riderColors.muted,
    fontFamily: riderFonts.semibold,
    fontSize: 9.5,
    fontWeight: '800',
  },
  checkPillTextDone: {
    color: riderColors.greenDark,
  },
  resourcesCard: {
    borderRadius: 20,
    backgroundColor: riderColors.white,
    borderWidth: 1,
    borderColor: riderColors.line,
    paddingHorizontal: 14,
    marginBottom: 18,
    ...riderShadow,
  },
  resourceRow: {
    minHeight: 57,
    borderBottomWidth: 1,
    borderBottomColor: riderColors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  resourceIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: riderColors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceTitle: {
    flex: 1,
    color: riderColors.ink,
    fontFamily: riderFonts.medium,
    fontSize: 12.5,
    fontWeight: '700',
  },
  supportBand: {
    minHeight: 84,
    borderRadius: 19,
    backgroundColor: riderColors.greenMist,
    borderWidth: 1,
    borderColor: riderColors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
  },
  supportIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: riderColors.greenDark,
    borderWidth: 5,
    borderColor: '#CDEEDD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportCopy: {
    flex: 1,
    minWidth: 0,
  },
  supportTitle: {
    color: riderColors.ink,
    fontFamily: riderFonts.bold,
    fontSize: 13.5,
    fontWeight: '900',
  },
  supportBody: {
    color: riderColors.muted,
    fontFamily: riderFonts.regular,
    fontSize: 9,
    lineHeight: 13,
    marginTop: 2,
  },
  supportButton: {
    minHeight: 43,
    borderRadius: 13,
    backgroundColor: riderColors.greenDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 11,
  },
  supportButtonText: {
    color: riderColors.white,
    fontFamily: riderFonts.semibold,
    fontSize: 10.5,
    fontWeight: '900',
  },
  modalFlex: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(7,17,13,0.58)',
  },
  reportSheet: {
    maxHeight: '91%',
    borderTopLeftRadius: 27,
    borderTopRightRadius: 27,
    backgroundColor: riderColors.white,
    padding: 18,
  },
  guidanceSheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 27,
    borderTopRightRadius: 27,
    backgroundColor: riderColors.white,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 17,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: riderColors.line,
    alignSelf: 'center',
    marginBottom: 13,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  guidanceHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    marginBottom: 18,
  },
  guidanceIcon: {
    width: 49,
    height: 49,
    borderRadius: 17,
    backgroundColor: riderColors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitleWrap: {
    flex: 1,
  },
  sheetTitle: {
    color: riderColors.ink,
    fontFamily: riderFonts.bold,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },
  sheetSubtitle: {
    color: riderColors.muted,
    fontFamily: riderFonts.regular,
    fontSize: 10.5,
    lineHeight: 16,
    marginTop: 3,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: riderColors.panelAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    color: riderColors.ink,
    fontFamily: riderFonts.semibold,
    fontSize: 12.5,
    fontWeight: '900',
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 9,
    marginBottom: 13,
  },
  categoryChip: {
    minHeight: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: riderColors.line,
    backgroundColor: riderColors.white,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipSelected: {
    borderColor: riderColors.greenDark,
    backgroundColor: riderColors.greenSoft,
  },
  categoryText: {
    color: riderColors.ink,
    fontFamily: riderFonts.medium,
    fontSize: 10.5,
    fontWeight: '700',
  },
  categoryTextSelected: {
    color: riderColors.greenDark,
    fontFamily: riderFonts.semibold,
    fontWeight: '800',
  },
  detailsInput: {
    minHeight: 118,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  emailButton: {
    marginTop: 8,
  },
  emergencyReminder: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: riderColors.redSoft,
    borderWidth: 1,
    borderColor: '#F7C6C1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    marginTop: 9,
    marginBottom: 4,
  },
  emergencyReminderText: {
    flex: 1,
    color: '#A32F27',
    fontFamily: riderFonts.medium,
    fontSize: 10.5,
    lineHeight: 15,
    fontWeight: '700',
  },
  guidancePoints: {
    gap: 12,
    marginBottom: 20,
  },
  guidancePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  guidanceBullet: {
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: riderColors.greenDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  guidancePointText: {
    flex: 1,
    color: riderColors.ink2,
    fontFamily: riderFonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
});
