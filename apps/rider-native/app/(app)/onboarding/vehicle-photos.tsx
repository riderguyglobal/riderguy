import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import Toast from 'react-native-toast-message';
import { EmptyState, RiderButton, RiderCard, RiderHeader, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

const PHOTO_SLOTS = [
  { id: 'front', label: 'Front view' },
  { id: 'back', label: 'Back view' },
  { id: 'left', label: 'Left side' },
  { id: 'right', label: 'Right side' },
] as const;

type PhotoPosition = typeof PHOTO_SLOTS[number]['id'];

export default function VehiclePhotosScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const [photos, setPhotos] = useState<Partial<Record<PhotoPosition, ImagePicker.ImagePickerAsset>>>({});
  const { api } = useAuth();
  const qc = useQueryClient();

  const { data: vehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['rider-vehicles'],
    queryFn: async () => {
      const { data } = await api.get('/riders/vehicles');
      return (data.data ?? data) as any[];
    },
  });

  const targetVehicleId = useMemo(() => vehicleId ?? vehicles?.find((vehicle) => vehicle.isPrimary)?.id ?? vehicles?.[0]?.id, [vehicleId, vehicles]);

  const pickPhoto = async (id: PhotoPosition) => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((current) => ({ ...current, [id]: result.assets[0] }));
    }
  };

  const allDone = PHOTO_SLOTS.every((slot) => photos[slot.id]);

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async () => {
      if (!targetVehicleId) throw new Error('Vehicle not found');
      for (const slot of PHOTO_SLOTS) {
        const asset = photos[slot.id];
        if (!asset) continue;
        const form = new FormData();
        form.append('position', slot.id);
        form.append('photo', {
          uri: asset.uri,
          type: asset.mimeType ?? 'image/jpeg',
          name: asset.fileName ?? `vehicle_${slot.id}.jpg`,
        } as any);
        await api.post(`/riders/vehicles/${targetVehicleId}/photos`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['rider-onboarding-status'] });
      await qc.invalidateQueries({ queryKey: ['rider-vehicles'] });
      Toast.show({ type: 'success', text1: 'Vehicle photos uploaded.' });
      router.push('/(app)/onboarding');
    },
    onError: (error: any) => Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? error?.message ?? 'Upload failed.' }),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader title="Vehicle photos" subtitle="Show the vehicle from every angle" canGoBack right={<StatusPill status={allDone ? 'ONLINE' : 'PENDING'} label={allDone ? 'Ready' : '4 shots'} />} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {!vehiclesLoading && !targetVehicleId ? (
          <EmptyState
            icon="bicycle-outline"
            title="Register a vehicle first"
            body="Photos need to attach to a saved vehicle profile."
            action={<RiderButton label="Add vehicle" icon="add-circle" onPress={() => router.push('/(app)/onboarding/vehicle')} />}
          />
        ) : (
          <>
            <RiderCard dark style={{ marginBottom: 14 }}>
              <Text style={{ color: riderColors.white, fontSize: 18, fontWeight: '900' }}>Four clean angles.</Text>
              <Text style={{ color: '#9fb0c4', fontSize: 13, lineHeight: 19, marginTop: 8 }}>
                Keep the full vehicle inside the frame. Make the plate area clear where visible.
              </Text>
            </RiderCard>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {PHOTO_SLOTS.map((slot) => {
                const asset = photos[slot.id];
                return (
                  <TouchableOpacity key={slot.id} onPress={() => pickPhoto(slot.id)} activeOpacity={0.84} style={{ width: '48%' }}>
                    <RiderCard style={{ padding: 0, overflow: 'hidden' }}>
                      {asset ? (
                        <Image source={{ uri: asset.uri }} style={{ width: '100%', height: 132, backgroundColor: riderColors.panelAlt }} resizeMode="cover" />
                      ) : (
                        <View style={{ height: 132, alignItems: 'center', justifyContent: 'center', backgroundColor: riderColors.panelAlt }}>
                          <Ionicons name="camera-outline" size={28} color={riderColors.soft} />
                          <Text style={{ color: riderColors.muted, fontWeight: '900', fontSize: 12, marginTop: 8 }}>{slot.label}</Text>
                        </View>
                      )}
                      <View style={{ padding: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ color: riderColors.ink, fontWeight: '900', fontSize: 12 }}>{slot.label}</Text>
                        <Ionicons name={asset ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={asset ? riderColors.greenDark : riderColors.soft} />
                      </View>
                    </RiderCard>
                  </TouchableOpacity>
                );
              })}
            </View>

            <RiderButton
              label={isPending ? 'Uploading photos' : 'Submit vehicle photos'}
              icon="cloud-upload"
              loading={isPending}
              disabled={!allDone || !targetVehicleId}
              onPress={() => submit()}
              style={{ marginTop: 18 }}
            />
            {isPending ? <ActivityIndicator color={riderColors.green} style={{ marginTop: 12 }} /> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
