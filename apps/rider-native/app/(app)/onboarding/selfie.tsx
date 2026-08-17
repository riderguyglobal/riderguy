import { useState } from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import Toast from 'react-native-toast-message';
import { RiderButton, RiderCard, RiderHeader, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

export default function SelfieScreen() {
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const { api } = useAuth();
  const qc = useQueryClient();

  const takeSelfie = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) setAsset(result.assets[0]);
  };

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async () => {
      if (!asset) return;
      const form = new FormData();
      form.append('type', 'SELFIE');
      form.append('file', {
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: asset.fileName ?? 'selfie.jpg',
      } as any);
      await api.post('/documents/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['rider-onboarding-status'] });
      Toast.show({ type: 'success', text1: 'Selfie submitted.' });
      router.push('/(app)/onboarding/vehicle');
    },
    onError: (error: any) => Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Upload failed.' }),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader title="Selfie check" subtitle="A live face match for account safety" canGoBack right={<StatusPill status={asset ? 'ONLINE' : 'PENDING'} label={asset ? 'Ready' : 'Needed'} />} />

      <View style={{ flex: 1, padding: 18 }}>
        <RiderCard dark style={{ marginBottom: 18 }}>
          <Text style={{ color: riderColors.white, fontSize: 18, fontWeight: '900' }}>Face the camera directly.</Text>
          <Text style={{ color: '#9fb0c4', fontSize: 13, lineHeight: 19, marginTop: 8 }}>
            Use even lighting, remove heavy glare, and keep your face centered.
          </Text>
        </RiderCard>

        <TouchableOpacity onPress={takeSelfie} activeOpacity={0.86} style={{ alignItems: 'center', marginBottom: 20 }}>
          {asset ? (
            <View style={{ alignItems: 'center' }}>
              <Image source={{ uri: asset.uri }} style={{ width: 248, height: 248, borderRadius: 124, borderWidth: 5, borderColor: riderColors.green }} resizeMode="cover" />
              <Text style={{ color: riderColors.greenDark, fontSize: 13, fontWeight: '900', marginTop: 12 }}>Tap to retake</Text>
            </View>
          ) : (
            <View style={{ width: 248, height: 248, borderRadius: 124, backgroundColor: riderColors.white, borderWidth: 2, borderColor: riderColors.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="person-circle-outline" size={70} color={riderColors.soft} />
              <Text style={{ color: riderColors.muted, fontSize: 13, fontWeight: '900', marginTop: 6 }}>Take selfie</Text>
            </View>
          )}
        </TouchableOpacity>

        <RiderCard style={{ marginBottom: 18 }}>
          {['Good lighting', 'No filters', 'Face fully visible', 'Matches your ID'].map((tip) => (
            <View key={tip} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
              <Ionicons name="checkmark-circle" size={19} color={riderColors.greenDark} />
              <Text style={{ color: riderColors.ink, fontSize: 13, fontWeight: '800' }}>{tip}</Text>
            </View>
          ))}
        </RiderCard>

        <RiderButton label="Submit selfie" icon="scan" loading={isPending} disabled={!asset} onPress={() => submit()} />
        {isPending ? <ActivityIndicator color={riderColors.green} style={{ marginTop: 12 }} /> : null}
      </View>
    </SafeAreaView>
  );
}
