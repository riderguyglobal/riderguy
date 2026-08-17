import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import Toast from 'react-native-toast-message';
import { RiderButton, RiderCard, RiderHeader, RiderTextField, SegmentedControl, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

const VEHICLE_TYPES = [
  { label: 'Bike', value: 'MOTORCYCLE' },
  { label: 'Cycle', value: 'BICYCLE' },
  { label: 'Car', value: 'CAR' },
  { label: 'Van', value: 'VAN' },
] as const;

type VehicleType = typeof VEHICLE_TYPES[number]['value'];

export default function VehicleScreen() {
  const [vehicleType, setVehicleType] = useState<VehicleType>('MOTORCYCLE');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [plate, setPlate] = useState('');
  const [color, setColor] = useState('');
  const { api } = useAuth();
  const qc = useQueryClient();

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async () => {
      const payload = {
        type: vehicleType,
        make: make.trim(),
        model: model.trim(),
        year: year ? Number(year) : undefined,
        plateNumber: plate.trim().toUpperCase(),
        color: color.trim() || undefined,
      };
      const { data } = await api.post('/riders/vehicles', payload);
      return data.data ?? data;
    },
    onSuccess: async (vehicle) => {
      await qc.invalidateQueries({ queryKey: ['rider-onboarding-status'] });
      await qc.invalidateQueries({ queryKey: ['rider-vehicles'] });
      Toast.show({ type: 'success', text1: 'Vehicle saved.' });
      router.push({ pathname: '/(app)/onboarding/vehicle-photos' as any, params: { vehicleId: vehicle.id } });
    },
    onError: (error: any) => Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Could not save vehicle.' }),
  });

  const isValid = make.trim() && model.trim() && plate.trim() && (!year || year.length === 4);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader title="Vehicle profile" subtitle="The machine behind every route" canGoBack right={<StatusPill status={isValid ? 'ONLINE' : 'PENDING'} label={isValid ? 'Ready' : 'Draft'} />} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <RiderCard dark style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 52, height: 52, borderRadius: 17, backgroundColor: '#142942', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="speedometer" size={25} color={riderColors.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: riderColors.white, fontSize: 18, fontWeight: '900' }}>Register the vehicle you use most.</Text>
              <Text style={{ color: '#9fb0c4', fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                Plate and type help dispatch pick the right orders for you.
              </Text>
            </View>
          </View>
        </RiderCard>

        <RiderCard>
          <Text style={{ color: riderColors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 9 }}>Vehicle type</Text>
          <SegmentedControl value={vehicleType} options={[...VEHICLE_TYPES]} onChange={setVehicleType} />

          <View style={{ marginTop: 16 }}>
            <RiderTextField label="Make" placeholder="Honda, TVS, Yamaha" value={make} onChangeText={setMake} />
            <RiderTextField label="Model" placeholder="CGL 125, Apache, Corolla" value={model} onChangeText={setModel} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <RiderTextField label="Year" placeholder="2024" value={year} onChangeText={(value) => setYear(value.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" containerStyle={{ flex: 1 }} />
              <RiderTextField label="Color" placeholder="Black" value={color} onChangeText={setColor} containerStyle={{ flex: 1 }} />
            </View>
            <RiderTextField label="Plate number" placeholder="GR-1234-24" value={plate} onChangeText={setPlate} autoCapitalize="characters" />
          </View>

          <RiderButton label="Save and add photos" icon="arrow-forward" loading={isPending} disabled={!isValid} onPress={() => submit()} />
        </RiderCard>

        <TouchableOpacity onPress={() => router.push('/(app)/onboarding/vehicle-photos' as any)} activeOpacity={0.8} style={{ marginTop: 14, alignItems: 'center' }}>
          <Text style={{ color: riderColors.muted, fontSize: 12, fontWeight: '800' }}>Already registered a vehicle? Add photos</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
