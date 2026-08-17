import { useState } from 'react';
import { View, Text, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const PREFS = [
  { id: 'order_updates', label: 'Order Updates', desc: 'Status changes for your deliveries' },
  { id: 'promotions', label: 'Promotions', desc: 'Discounts and special offers' },
  { id: 'rider_location', label: 'Rider Nearby', desc: 'When a rider is close to pickup/drop' },
];

export default function NotificationPrefsScreen() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ order_updates: true, promotions: false, rider_location: true });

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center px-5 py-4 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900">Notifications</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {PREFS.map((pref, index) => (
            <View key={pref.id} className={`flex-row items-center px-5 py-4 ${index < PREFS.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <View className="flex-1">
                <Text className="font-medium text-gray-900">{pref.label}</Text>
                <Text className="text-sm text-gray-500 mt-0.5">{pref.desc}</Text>
              </View>
              <Switch
                value={enabled[pref.id] ?? false}
                onValueChange={(val) => setEnabled((prev) => ({ ...prev, [pref.id]: val }))}
                trackColor={{ true: '#22c55e', false: '#e5e7eb' }}
                thumbColor="white"
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
