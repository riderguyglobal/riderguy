import { View, Text, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

export default function AboutScreen() {
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const links = [
    { label: 'Terms of Service', url: 'https://riderguy.com/terms' },
    { label: 'Privacy Policy', url: 'https://riderguy.com/privacy' },
    { label: 'Delete Account', url: 'https://myriderguy.com/delete-account' },
    { label: 'Contact Support', url: 'mailto:support@riderguy.com' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center px-5 py-4 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900">About RiderGuy</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="bg-white rounded-2xl p-6 items-center mb-4 border border-gray-100">
          <View className="w-20 h-20 bg-primary-500 rounded-2xl items-center justify-center mb-4">
            <Text className="text-white text-3xl font-bold">R</Text>
          </View>
          <Text className="text-xl font-bold text-gray-900">RiderGuy</Text>
          <Text className="text-gray-500 text-sm mt-1">Version {version}</Text>
          <Text className="text-gray-400 text-xs mt-1">Client App</Text>
        </View>

        <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
          {links.map((link, index) => (
            <TouchableOpacity
              key={link.label}
              className={`flex-row items-center px-5 py-4 ${index < links.length - 1 ? 'border-b border-gray-50' : ''}`}
              onPress={() => Linking.openURL(link.url)}
            >
              <Text className="flex-1 font-medium text-gray-800">{link.label}</Text>
              <Ionicons name="open-outline" size={16} color="#9ca3af" />
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-center text-gray-400 text-xs mt-4">
          (c) {new Date().getFullYear()} RiderGuy. All rights reserved.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
