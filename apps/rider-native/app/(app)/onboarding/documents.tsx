import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import Toast from 'react-native-toast-message';
import { RiderButton, RiderCard, RiderHeader, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

type DocumentType = 'NATIONAL_ID' | 'DRIVERS_LICENSE' | 'INSURANCE_CERTIFICATE';

const DOCUMENTS: {
  type: DocumentType;
  title: string;
  body: string;
  optional?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { type: 'NATIONAL_ID', title: 'National ID', body: 'Ghana Card, passport, or other government ID.', icon: 'card-outline' },
  { type: 'DRIVERS_LICENSE', title: "Driver's license", body: 'A clear current license for rider verification.', icon: 'card-outline' },
  { type: 'INSURANCE_CERTIFICATE', title: 'Insurance certificate', body: 'Optional vehicle insurance document.', optional: true, icon: 'shield-checkmark-outline' },
];

export default function DocumentsScreen() {
  const [assets, setAssets] = useState<Partial<Record<DocumentType, ImagePicker.ImagePickerAsset>>>({});
  const { api } = useAuth();
  const qc = useQueryClient();

  const pickImage = async (type: DocumentType) => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
      allowsEditing: true,
      aspect: [16, 10],
    });
    if (!result.canceled && result.assets[0]) {
      setAssets((current) => ({ ...current, [type]: result.assets[0] }));
    }
  };

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async () => {
      const selected = DOCUMENTS.filter((doc) => assets[doc.type]);
      for (const doc of selected) {
        const asset = assets[doc.type]!;
        const form = new FormData();
        form.append('type', doc.type);
        form.append('file', {
          uri: asset.uri,
          type: asset.mimeType ?? 'image/jpeg',
          name: asset.fileName ?? `${doc.type.toLowerCase()}.jpg`,
        } as any);
        await api.post('/documents/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['rider-onboarding-status'] });
      Toast.show({ type: 'success', text1: 'Documents sent for review.' });
      router.push('/(app)/onboarding/selfie');
    },
    onError: (error: any) => Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Upload failed.' }),
  });

  const requiredDone = !!assets.NATIONAL_ID && !!assets.DRIVERS_LICENSE;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader title="Documents" subtitle="Clear files move review faster" canGoBack right={<StatusPill status={requiredDone ? 'ONLINE' : 'PENDING'} label={requiredDone ? 'Ready' : 'Required'} />} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <RiderCard dark style={{ marginBottom: 14 }}>
          <Text style={{ color: riderColors.white, fontSize: 18, fontWeight: '900' }}>Capture clean edges and readable text.</Text>
          <Text style={{ color: '#9fb0c4', fontSize: 13, lineHeight: 19, marginTop: 8 }}>
            Use good light, keep glare off the card, and make sure the full document is inside the frame.
          </Text>
        </RiderCard>

        <View style={{ gap: 12 }}>
          {DOCUMENTS.map((doc) => {
            const asset = assets[doc.type];
            return (
              <TouchableOpacity key={doc.type} onPress={() => pickImage(doc.type)} activeOpacity={0.84}>
                <RiderCard style={{ padding: 0, overflow: 'hidden' }}>
                  {asset ? (
                    <Image source={{ uri: asset.uri }} style={{ width: '100%', height: 176, backgroundColor: riderColors.panelAlt }} resizeMode="cover" />
                  ) : (
                    <View style={{ height: 176, alignItems: 'center', justifyContent: 'center', backgroundColor: riderColors.panelAlt }}>
                      <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: riderColors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: riderColors.line }}>
                        <Ionicons name={doc.icon} size={28} color={riderColors.greenDark} />
                      </View>
                      <Text style={{ color: riderColors.muted, fontSize: 12, fontWeight: '900', marginTop: 10 }}>Tap to capture</Text>
                    </View>
                  )}
                  <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900' }}>{doc.title}</Text>
                        {doc.optional ? <StatusPill status="OFFLINE" label="Optional" /> : null}
                      </View>
                      <Text style={{ color: riderColors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 }}>{doc.body}</Text>
                    </View>
                    <Ionicons name={asset ? 'refresh' : 'camera'} size={20} color={asset ? riderColors.greenDark : riderColors.soft} />
                  </View>
                </RiderCard>
              </TouchableOpacity>
            );
          })}
        </View>

        <RiderButton
          label={isPending ? 'Uploading documents' : 'Submit documents'}
          icon="cloud-upload"
          loading={isPending}
          disabled={!requiredDone}
          onPress={() => submit()}
          style={{ marginTop: 18 }}
        />
        {isPending ? <ActivityIndicator color={riderColors.green} style={{ marginTop: 12 }} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
