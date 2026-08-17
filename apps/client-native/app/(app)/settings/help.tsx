import { View, Text, TouchableOpacity, Linking, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const FAQ = [
  { q: 'How do I track my order?', a: 'Go to Orders tab and tap on any active order to see real-time tracking.' },
  { q: 'How do I pay for deliveries?', a: 'You can top up your wallet via mobile money or card, then pay seamlessly at checkout.' },
  { q: 'What if my package is damaged?', a: 'Contact support immediately with photos. We have a protection policy for all deliveries.' },
  { q: 'How long does delivery take?', a: 'Same-city deliveries typically take 30-90 minutes depending on distance and traffic.' },
];

export default function HelpScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center px-5 py-4 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900">Help & Support</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity
          className="bg-primary-500 rounded-2xl p-5 mb-6 flex-row items-center"
          onPress={() => Linking.openURL('mailto:support@riderguy.com')}
        >
          <Ionicons name="mail-outline" size={24} color="white" />
          <View className="ml-4">
            <Text className="text-white font-bold">Email Support</Text>
            <Text className="text-white opacity-80 text-sm">support@riderguy.com</Text>
          </View>
        </TouchableOpacity>

        <Text className="font-bold text-gray-900 text-base mb-4">Frequently Asked Questions</Text>
        <View className="gap-3">
          {FAQ.map((item) => (
            <View key={item.q} className="bg-white rounded-2xl p-4 border border-gray-100">
              <Text className="font-semibold text-gray-900 mb-2">{item.q}</Text>
              <Text className="text-gray-600 text-sm leading-5">{item.a}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
