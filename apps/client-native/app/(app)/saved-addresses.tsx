import { Alert, FlatList, Modal, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { EmptyState, ScreenHeader } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';
import { useAuth } from '@riderguy/auth-native';
import { useState } from 'react';

const LABELS = ['Home', 'Work', 'Family', 'Other'];

export default function SavedAddressesScreen() {
  const { api } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState('Home');
  const [address, setAddress] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const addressesQuery = useQuery({
    queryKey: ['saved-addresses'],
    queryFn: async () => {
      const { data } = await api.get('/saved-addresses');
      return (data.data ?? data) as any[];
    },
  });

  const resetForm = () => {
    setLabel('Home');
    setAddress('');
    setInstructions('');
    setIsDefault(false);
  };

  const addAddress = useMutation({
    mutationFn: async () => api.post('/saved-addresses', { label, address, instructions, isDefault }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-addresses'] });
      setShowAdd(false);
      resetForm();
      Toast.show({ type: 'success', text1: 'Address saved' });
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: err?.response?.data?.error?.message ?? 'Could not save address' }),
  });

  const deleteAddress = useMutation({
    mutationFn: async (id: string) => api.delete(`/saved-addresses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-addresses'] }),
  });

  const askDelete = (item: any) => {
    Alert.alert('Delete address?', item.address, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteAddress.mutate(item.id) },
    ]);
  };

  const addresses = addressesQuery.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ScreenHeader
        title="Address Vault"
        subtitle="Save places you send from and to often"
        right={(
          <TouchableOpacity onPress={() => setShowAdd(true)} style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={addresses}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={addressesQuery.isFetching} onRefresh={addressesQuery.refetch} tintColor={colors.brand} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 10 }}
        ListHeaderComponent={
          addresses.length > 0 ? (
            <View style={{ borderRadius: 24, backgroundColor: colors.ink, padding: 18, marginBottom: 4, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', right: -44, top: -42, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(10,185,87,0.18)' }} />
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>{addresses.length} saved place{addresses.length === 1 ? '' : 's'}</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 5, lineHeight: 18 }}>A cleaner checkout starts with trusted addresses.</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !addressesQuery.isLoading ? (
            <EmptyState
              icon="location-outline"
              title="No saved addresses"
              body="Save home, work, and frequent dropoff points so future deliveries are faster."
              action="Add Address"
              onPress={() => setShowAdd(true)}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View style={{ borderRadius: 20, backgroundColor: '#fff', padding: 15, borderWidth: 1, borderColor: '#EEF2F7', flexDirection: 'row', alignItems: 'center', gap: 12, ...shadow.card }}>
            <View style={{ width: 44, height: 44, borderRadius: 18, backgroundColor: item.isDefault ? colors.brand : colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={item.label?.toLowerCase?.().includes('work') ? 'business-outline' : 'home-outline'} size={20} color={item.isDefault ? '#fff' : colors.brandDark} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '900' }}>{item.label}</Text>
                {item.isDefault && (
                  <View style={{ borderRadius: 999, backgroundColor: colors.brandSoft, paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Text style={{ color: colors.brandDark, fontSize: 9, fontWeight: '900' }}>Default</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }} numberOfLines={1}>{item.address}</Text>
              {!!item.instructions && <Text style={{ color: colors.subtle, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{item.instructions}</Text>}
            </View>
            <TouchableOpacity onPress={() => askDelete(item)} style={{ width: 34, height: 34, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2' }}>
              <Ionicons name="trash-outline" size={17} color={colors.red} />
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#fff', padding: 20 }}>
            <View style={{ width: 44, height: 5, borderRadius: 999, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 }}>Save a place</Text>
            <Text style={{ color: colors.subtle, fontSize: 12, marginTop: 4, marginBottom: 16 }}>Name it once. Use it in every delivery.</Text>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {LABELS.map((item) => {
                const active = label === item;
                return (
                  <TouchableOpacity key={item} onPress={() => setLabel(item)} style={{ flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center', backgroundColor: active ? colors.ink : '#F8FAFC' }}>
                    <Text style={{ color: active ? '#fff' : colors.text, fontSize: 11, fontWeight: '900' }}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput value={address} onChangeText={setAddress} placeholder="Street, landmark, city" placeholderTextColor={colors.subtle} multiline style={{ minHeight: 82, borderRadius: 18, backgroundColor: '#F8FAFC', padding: 14, color: colors.ink, fontWeight: '700', textAlignVertical: 'top', marginBottom: 10 }} />
            <TextInput value={instructions} onChangeText={setInstructions} placeholder="Instructions (gate, floor, who to ask for)" placeholderTextColor={colors.subtle} style={{ height: 50, borderRadius: 16, backgroundColor: '#F8FAFC', paddingHorizontal: 14, color: colors.ink, marginBottom: 12 }} />

            <TouchableOpacity onPress={() => setIsDefault((value) => !value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <View style={{ width: 22, height: 22, borderRadius: 8, backgroundColor: isDefault ? colors.brand : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                {isDefault && <Ionicons name="checkmark" size={15} color="#fff" />}
              </View>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>Set as default address</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => { setShowAdd(false); resetForm(); }} style={{ flex: 1, height: 52, borderRadius: 18, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '900' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={!address || addAddress.isPending} onPress={() => addAddress.mutate()} style={{ flex: 1, height: 52, borderRadius: 18, backgroundColor: address ? colors.brand : '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>{addAddress.isPending ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
