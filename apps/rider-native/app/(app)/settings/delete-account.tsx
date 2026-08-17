import { useState } from 'react';
import { Alert, Linking, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@riderguy/auth-native';
import { RiderButton, RiderCard, RiderHeader } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

const DELETE_ACCOUNT_URL = 'https://myriderguy.com/delete-account';

export default function RiderDeleteAccountScreen() {
  const { api, user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitDeletionRequest = async () => {
    const contactEmail = email.trim();
    if (!contactEmail.includes('@')) {
      Alert.alert('Email required', 'Enter an email address so support can confirm your account deletion request.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/contact', {
        firstName: user?.firstName?.trim() || 'RiderGuy',
        lastName: user?.lastName?.trim() || 'Rider',
        email: contactEmail,
        subject: 'support',
        message: [
          'Account deletion request from the RiderGuy Rider native app.',
          `User ID: ${user?.id ?? 'unknown'}`,
          `Phone: ${user?.phone ?? 'not provided'}`,
          `Email: ${contactEmail}`,
          notes.trim() ? `Notes: ${notes.trim()}` : 'Notes: none',
        ].join('\n'),
      });

      Alert.alert(
        'Request sent',
        'Rider support will verify your identity and process the deletion request.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch {
      Alert.alert('Could not send request', 'Please try again or use the web deletion page.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader title="Delete Account" subtitle="Request permanent account deletion" canGoBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <RiderCard style={{ marginBottom: 14 }}>
          <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: riderColors.redSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Ionicons name="trash-outline" size={27} color={riderColors.red} />
          </View>
          <Text style={{ color: riderColors.ink, fontSize: 21, fontWeight: '900' }}>Request account deletion</Text>
          <Text style={{ color: riderColors.muted, fontSize: 13, lineHeight: 21, marginTop: 8 }}>
            This starts a permanent deletion request for your RiderGuy Rider account. We delete profile data, device tokens, and app settings where legally allowed. Delivery, payout, fraud-prevention, and tax records may be retained when required by law.
          </Text>
        </RiderCard>

        <RiderCard style={{ gap: 12, marginBottom: 14 }}>
          <View>
            <Text style={{ color: riderColors.ink, fontSize: 13, fontWeight: '900', marginBottom: 8 }}>Confirmation email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={riderColors.soft}
              style={{ minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: riderColors.line, backgroundColor: riderColors.panelAlt, paddingHorizontal: 14, color: riderColors.ink, fontWeight: '700' }}
            />
          </View>

          <View>
            <Text style={{ color: riderColors.ink, fontSize: 13, fontWeight: '900', marginBottom: 8 }}>Optional notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
              placeholder="Anything rider support should know?"
              placeholderTextColor={riderColors.soft}
              style={{ minHeight: 104, borderRadius: 15, borderWidth: 1, borderColor: riderColors.line, backgroundColor: riderColors.panelAlt, paddingHorizontal: 14, paddingVertical: 12, color: riderColors.ink, fontWeight: '700' }}
            />
          </View>
        </RiderCard>

        <View style={{ gap: 10 }}>
          <RiderButton
            label="Submit Deletion Request"
            icon="send"
            variant="danger"
            loading={submitting}
            onPress={submitDeletionRequest}
          />
          <RiderButton
            label="Open Web Deletion Page"
            icon="open-outline"
            variant="ghost"
            onPress={() => Linking.openURL(DELETE_ACCOUNT_URL)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
