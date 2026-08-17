import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@riderguy/auth-native';

const DELETE_ACCOUNT_URL = 'https://myriderguy.com/delete-account';

export default function DeleteAccountScreen() {
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
        lastName: user?.lastName?.trim() || 'Client',
        email: contactEmail,
        subject: 'support',
        message: [
          'Account deletion request from the RiderGuy client native app.',
          `User ID: ${user?.id ?? 'unknown'}`,
          `Phone: ${user?.phone ?? 'not provided'}`,
          `Email: ${contactEmail}`,
          notes.trim() ? `Notes: ${notes.trim()}` : 'Notes: none',
        ].join('\n'),
      });

      Alert.alert(
        'Request sent',
        'Support will verify your identity and process the deletion request.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch {
      Alert.alert(
        'Could not send request',
        'Please try again or use the web deletion page.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center px-5 py-4 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900">Delete Account</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
        <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <View className="w-12 h-12 rounded-2xl bg-red-50 items-center justify-center mb-4">
            <Ionicons name="trash-outline" size={25} color="#DC2626" />
          </View>
          <Text className="text-xl font-extrabold text-gray-900">Request account deletion</Text>
          <Text className="text-gray-500 text-sm leading-6 mt-2">
            This starts a permanent deletion request for your RiderGuy client account. We delete profile data, saved app settings, and device tokens where legally allowed. Delivery, payment, fraud-prevention, and tax records may be retained when required by law.
          </Text>
        </View>

        <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <Text className="text-sm font-extrabold text-gray-900 mb-2">Confirmation email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor="#9CA3AF"
            className="h-12 rounded-xl bg-gray-50 border border-gray-100 px-4 text-gray-900"
          />

          <Text className="text-sm font-extrabold text-gray-900 mb-2 mt-4">Optional notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
            placeholder="Anything support should know?"
            placeholderTextColor="#9CA3AF"
            className="min-h-[96px] rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-gray-900"
          />
        </View>

        <TouchableOpacity
          onPress={submitDeletionRequest}
          disabled={submitting}
          className="h-14 rounded-2xl bg-red-600 items-center justify-center flex-row"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send-outline" size={18} color="#FFFFFF" />
              <Text className="text-white font-extrabold ml-2">Submit Deletion Request</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => Linking.openURL(DELETE_ACCOUNT_URL)}
          className="h-14 rounded-2xl bg-white border border-gray-100 items-center justify-center flex-row mt-3"
        >
          <Ionicons name="open-outline" size={18} color="#374151" />
          <Text className="text-gray-800 font-extrabold ml-2">Open Web Deletion Page</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
