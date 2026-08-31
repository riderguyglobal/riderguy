import { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import Toast from 'react-native-toast-message';
import { PinBoxes, RiderButton, RiderCard, RiderHeader, SegmentedControl, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

type ProofMode = 'PIN_CODE' | 'PHOTO';
type PaymentMethod = 'CASH' | 'MOBILE_MONEY' | 'CARD' | 'WALLET' | 'BANK_TRANSFER';

export default function ProofOfDeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const qc = useQueryClient();
  const [proofMode, setProofMode] = useState<ProofMode>('PIN_CODE');
  const [pin, setPin] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}`);
      return data.data ?? data;
    },
  });

  const paymentMethod = (order?.paymentMethod ?? 'CASH') as PaymentMethod;
  const isCashPayment = paymentMethod === 'CASH';
  const electronicPaymentVerified = !isCashPayment && order?.paymentStatus === 'COMPLETED';
  const paymentReady = isCashPayment || electronicPaymentVerified;

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.78,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
  };

  const complete = useMutation({
    mutationFn: async () => {
      if (isCashPayment) {
        if (!order?.riderPaymentConfirmed) {
          await api.post(`/orders/${id}/confirm-payment`, { actualPaymentMethod: 'CASH' });
        }
      } else if (!electronicPaymentVerified) {
        throw new Error('Electronic payment is still awaiting provider verification. Ask the customer to complete payment in their app.');
      }

      if (proofMode === 'PIN_CODE') {
        await api.post(`/orders/${id}/proof`, { proofType: 'PIN_CODE', proofData: pin, completeDelivery: true });
        return;
      }

      if (!photo) throw new Error('Photo proof is required');
      const form = new FormData();
      form.append('proofType', 'PHOTO');
      form.append('completeDelivery', 'true');
      form.append('file', {
        uri: photo.uri,
        type: photo.mimeType ?? 'image/jpeg',
        name: photo.fileName ?? 'delivery-proof.jpg',
      } as any);
      await api.post(`/orders/${id}/proof`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['order', id] }),
        qc.invalidateQueries({ queryKey: ['jobs-active'] }),
        qc.invalidateQueries({ queryKey: ['rider-wallet'] }),
      ]);
      Toast.show({ type: 'success', text1: 'Delivery completed.' });
      router.replace('/(tabs)/jobs');
    },
    onError: (error: any) => Alert.alert('Completion failed', error?.response?.data?.error?.message ?? error?.message ?? 'Could not complete delivery.'),
  });

  const proofReady = proofMode === 'PIN_CODE' ? pin.length === 6 : !!photo;
  const ready = paymentReady && proofReady;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader title="Proof of delivery" subtitle="Confirm payment, then close the job" canGoBack right={<StatusPill status={ready ? 'ONLINE' : 'PENDING'} label={ready ? 'Ready' : 'Proof'} />} />

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={riderColors.green} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
          <RiderCard dark style={{ marginBottom: 14 }}>
            <Text style={{ color: riderColors.white, fontSize: 18, fontWeight: '900' }}>Finish clean.</Text>
            <Text style={{ color: '#9fb0c4', fontSize: 13, lineHeight: 19, marginTop: 8 }}>
              Confirm how payment was received, then submit the customer PIN or a delivery photo. The job will move to delivered automatically.
            </Text>
          </RiderCard>

          <RiderCard style={{ marginBottom: 14 }}>
            <Text style={{ color: riderColors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 9 }}>Payment received by</Text>
            <View style={{ borderRadius: 16, backgroundColor: paymentReady ? riderColors.greenSoft : riderColors.amberSoft, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <Ionicons
                name={paymentReady ? 'checkmark-circle' : 'time-outline'}
                size={24}
                color={paymentReady ? riderColors.greenDark : riderColors.amber}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: riderColors.ink, fontSize: 14, fontWeight: '900' }}>
                  {paymentMethod.replace(/_/g, ' ')}
                </Text>
                <Text style={{ color: riderColors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 }}>
                  {isCashPayment
                    ? 'Confirm cash only after it has been collected from the customer.'
                    : electronicPaymentVerified
                      ? 'Payment was verified by the electronic payment provider.'
                      : 'Waiting for the customer to complete payment in their app.'}
                </Text>
              </View>
            </View>
          </RiderCard>

          <RiderCard style={{ marginBottom: 14 }}>
            <Text style={{ color: riderColors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 9 }}>Proof type</Text>
            <SegmentedControl
              value={proofMode}
              options={[
                { label: 'PIN', value: 'PIN_CODE' },
                { label: 'Photo', value: 'PHOTO' },
              ]}
              onChange={setProofMode}
            />

            {proofMode === 'PIN_CODE' ? (
              <View style={{ marginTop: 18 }}>
                <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900', textAlign: 'center' }}>Enter customer delivery PIN</Text>
                <PinBoxes value={pin} onChange={setPin} length={6} secure />
              </View>
            ) : (
              <TouchableOpacity onPress={takePhoto} activeOpacity={0.84} style={{ marginTop: 18 }}>
                {photo ? (
                  <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 220, borderRadius: 16, backgroundColor: riderColors.panelAlt }} resizeMode="cover" />
                ) : (
                  <View style={{ height: 220, borderRadius: 16, backgroundColor: riderColors.panelAlt, borderWidth: 1, borderColor: riderColors.line, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="camera-outline" size={38} color={riderColors.soft} />
                    <Text style={{ color: riderColors.muted, fontSize: 13, fontWeight: '900', marginTop: 10 }}>Take delivery photo</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </RiderCard>

          <RiderButton
            label="Complete delivery"
            icon="checkmark-circle"
            loading={complete.isPending}
            disabled={!ready}
            onPress={() => complete.mutate()}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
