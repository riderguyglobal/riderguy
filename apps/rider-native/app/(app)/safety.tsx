import { Alert, Linking, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@riderguy/auth-native';
import {
  ActionBand,
  RiderButton,
  RiderCard,
  RiderHeader,
  RiderTextField,
  StatusPill,
} from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

const SAFETY_GUIDES = [
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Before every trip',
    body: 'Check your helmet, brakes, tyres, lights, phone charge, and delivery bag before going online.',
  },
  {
    icon: 'navigate-outline' as const,
    title: 'Ride defensively',
    body: 'Follow road rules, keep a safe distance, avoid phone use while moving, and stop safely before checking the route.',
  },
  {
    icon: 'alert-circle-outline' as const,
    title: 'If an incident happens',
    body: 'Move to safety when possible, contact emergency services when needed, then notify RiderGuy support with the delivery details.',
  },
];

export default function SafetyCenterScreen() {
  const { api, user } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState('Delivery safety concern');
  const [email, setEmail] = useState(user?.email ?? '');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const callEmergencyServices = () => {
    Alert.alert(
      'Call emergency services?',
      'Use this only for an urgent safety or medical emergency in Ghana.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call 112', style: 'destructive', onPress: () => Linking.openURL('tel:112') },
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
      await api.post('/contact', {
        firstName: user?.firstName?.trim() || 'RiderGuy',
        lastName: user?.lastName?.trim() || 'Rider',
        email: contactEmail,
        subject: 'rider',
        message: [
          'Safety Center report from the RiderGuy Rider app.',
          `Category: ${reportType}`,
          `Rider user ID: ${user?.id ?? 'unknown'}`,
          `Rider phone: ${user?.phone ?? 'not provided'}`,
          `Details: ${details.trim()}`,
        ].join('\n'),
      });
      setReportOpen(false);
      setDetails('');
      Alert.alert(
        'Safety report sent',
        'The RiderGuy administrator support inbox has received your report. Call 112 separately for an immediate emergency.',
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader
        title="Safety Center"
        subtitle="Guidance and help for every delivery"
        canGoBack
        right={<StatusPill status="ONLINE" label="Ready" />}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 34 }}
        showsVerticalScrollIndicator={false}
      >
        <RiderCard dark style={{ marginBottom: 14 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 20,
              backgroundColor: riderColors.green,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <Ionicons name="shield-checkmark" size={29} color={riderColors.white} />
          </View>
          <Text style={{ color: riderColors.white, fontSize: 21, fontWeight: '900' }}>
            Ride safe. Deliver safe.
          </Text>
          <Text style={{ color: '#B8C8BF', fontSize: 13, lineHeight: 19, marginTop: 7 }}>
            Your safety comes before a delivery. Stop the trip and get help whenever conditions
            become unsafe.
          </Text>
        </RiderCard>

        <View style={{ gap: 10, marginBottom: 14 }}>
          {SAFETY_GUIDES.map((guide) => (
            <RiderCard key={guide.title} style={{ padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 16,
                    backgroundColor: riderColors.greenSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={guide.icon} size={22} color={riderColors.greenDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900' }}>
                    {guide.title}
                  </Text>
                  <Text
                    style={{ color: riderColors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}
                  >
                    {guide.body}
                  </Text>
                </View>
              </View>
            </RiderCard>
          ))}
        </View>

        <View style={{ gap: 10 }}>
          <ActionBand
            icon="school"
            title="Safety training"
            body="Review road discipline and incident-response modules."
            buttonLabel="Open"
            buttonIcon="arrow-forward"
            onPress={() => router.push('/(app)/training')}
          />

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => setReportOpen(true)}
            style={{
              minHeight: 58,
              borderRadius: 16,
              backgroundColor: riderColors.white,
              borderWidth: 1,
              borderColor: riderColors.line,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 15,
              gap: 12,
            }}
          >
            <Ionicons name="headset" size={23} color={riderColors.greenDark} />
            <Text style={{ color: riderColors.ink, fontSize: 14, fontWeight: '900', flex: 1 }}>
              Report to RiderGuy safety support
            </Text>
            <Ionicons name="arrow-forward" size={18} color={riderColors.soft} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={callEmergencyServices}
            style={{
              minHeight: 58,
              borderRadius: 16,
              backgroundColor: riderColors.redSoft,
              borderWidth: 1,
              borderColor: '#FECACA',
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 15,
              gap: 12,
            }}
          >
            <Ionicons name="call" size={23} color={riderColors.red} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: riderColors.red, fontSize: 14, fontWeight: '900' }}>
                Emergency services
              </Text>
              <Text style={{ color: '#9F3030', fontSize: 11, marginTop: 2 }}>
                Call Ghana emergency number 112
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={riderColors.red} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={reportOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setReportOpen(false)}
      >
        <SafeAreaView
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,17,13,0.58)' }}
          edges={['bottom']}
        >
          <View
            style={{
              maxHeight: '90%',
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              backgroundColor: riderColors.white,
              padding: 18,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: riderColors.ink, fontSize: 20, fontWeight: '900' }}>
                  Safety support report
                </Text>
                <Text style={{ color: riderColors.muted, fontSize: 11.5, marginTop: 3 }}>
                  Sent directly to the RiderGuy administrator inbox
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close safety report"
                onPress={() => setReportOpen(false)}
                disabled={submitting}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: riderColors.panelAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={22} color={riderColors.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={{ color: riderColors.ink, fontSize: 13, fontWeight: '900' }}>
                Report category
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 9,
                  marginBottom: 13,
                }}
              >
                {[
                  'Delivery safety concern',
                  'Road incident',
                  'Vehicle safety',
                  'Threat or harassment',
                ].map((type) => {
                  const selected = reportType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setReportType(type)}
                      style={{
                        minHeight: 42,
                        borderRadius: 13,
                        borderWidth: 1,
                        borderColor: selected ? riderColors.greenDark : riderColors.line,
                        backgroundColor: selected ? riderColors.greenSoft : riderColors.white,
                        paddingHorizontal: 11,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? riderColors.greenDark : riderColors.ink,
                          fontSize: 11.5,
                          fontWeight: '800',
                        }}
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
                inputStyle={{ minHeight: 118, textAlignVertical: 'top', paddingTop: 12 }}
              />
              <RiderButton
                label="Send to RiderGuy"
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
                onPress={() =>
                  Linking.openURL(
                    'mailto:hello@myriderguy.com?subject=RiderGuy%20Rider%20Safety%20Support',
                  )
                }
                style={{ marginTop: 8 }}
              />
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
