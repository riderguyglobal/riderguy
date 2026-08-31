import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import Toast from 'react-native-toast-message';
import { EmptyState, ProgressBar, RiderButton, RiderCard, RiderHeader, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

type ModuleKey = 'SAFETY_BASICS' | 'SERVICE_STANDARDS' | 'DELIVERY_OPERATIONS';

type TrainingRecord = {
  key: ModuleKey;
  title: string;
  description: string;
  completedAt: string | null;
  verifiedAt: string | null;
};

type TrainingResponse = {
  riderChannel: 'GUEST' | 'IN_HOUSE' | null;
  modules: TrainingRecord[];
};

type LessonContent = {
  duration: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  objective: string;
  lessons: { title: string; body: string }[];
  checkpoint: string;
};

const LESSON_CONTENT: Record<ModuleKey, LessonContent> = {
  SAFETY_BASICS: {
    duration: '15 min',
    icon: 'shield-outline',
    color: riderColors.greenSoft,
    objective: 'Build a repeatable safety routine and know what to do when a trip becomes unsafe.',
    lessons: [
      { title: 'Before moving', body: 'Check your helmet strap, brakes, tyres, mirrors, lights, phone mount, fuel or charge, and delivery bag. Do not go online if the vehicle is unsafe.' },
      { title: 'Create space', body: 'Keep a safe following distance, stay visible, signal early, and avoid riding beside large vehicles where the driver may not see you.' },
      { title: 'Phone and route', body: 'Set the route before moving. If directions need attention, stop in a safe place before touching the phone.' },
      { title: 'Night and rain', body: 'Reduce speed, increase distance, use lights and reflective gear, and stop the trip when visibility or road conditions become unsafe.' },
      { title: 'Immediate danger', body: 'Move to safety when possible and call Ghana emergency services on 112 for urgent police, fire, or medical help.' },
      { title: 'Report facts', body: 'When safe, record the time, location, order number, and factual details. Contact RiderGuy through the Safety Center.' },
    ],
    checkpoint: 'I will protect people first, stop safely before using my phone, and report incidents accurately.',
  },
  SERVICE_STANDARDS: {
    duration: '12 min',
    icon: 'people-outline',
    color: riderColors.blueSoft,
    objective: 'Handle customers and packages professionally without exposing private information.',
    lessons: [
      { title: 'Confirm the recipient', body: 'Use the in-app contact flow and confirm the recipient name or delivery PIN. Never request an account password or payment PIN.' },
      { title: 'Protect the package', body: 'Keep the item closed and supported until the correct recipient is present. Follow fragile, upright, and temperature instructions.' },
      { title: 'Record respectful proof', body: 'Capture only the proof requested in the app. Avoid faces, private documents, interiors, or unrelated people unless the flow requires consent.' },
      { title: 'Communicate clearly', body: 'Give factual updates, stay respectful, and never share a customer address or phone number outside the delivery.' },
      { title: 'Unsafe or prohibited items', body: 'Do not transport leaking, prohibited, poorly sealed, or dangerously oversized items. Pause pickup and contact support.' },
    ],
    checkpoint: 'I will verify the recipient, protect private information, and finish proof in the app before leaving.',
  },
  DELIVERY_OPERATIONS: {
    duration: '14 min',
    icon: 'navigate-outline',
    color: riderColors.amberSoft,
    objective: 'Handle offers, navigation, pickup, drop-off, and proof accurately from one workflow.',
    lessons: [
      { title: 'Review the offer', body: 'Check pickup, drop-off, distance, package details, and earnings before accepting. Accept only when you can complete the trip safely.' },
      { title: 'Pickup checks', body: 'Confirm the order reference, package condition, and any handling notes before marking pickup complete.' },
      { title: 'Follow safe roads', body: 'A suggested route is guidance, not permission for an unsafe or illegal turn. Choose a lawful detour and let the ETA update.' },
      { title: 'Mark arrival honestly', body: 'Mark arrival only when safely stopped at the correct location. Do not advance the job from a nearby road.' },
      { title: 'Close the delivery', body: 'Verify the recipient, payment state, delivery PIN, and required proof before completing the order.' },
      { title: 'Unexpected delay', body: 'Use in-app communication for a material delay and contact dispatch if road closure, vehicle trouble, or a safety risk prevents completion.' },
    ],
    checkpoint: 'I will update each delivery stage only when the matching real-world step is complete.',
  },
};

export default function TrainingScreen() {
  const [selectedModule, setSelectedModule] = useState<TrainingRecord | null>(null);
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const training = useQuery({
    queryKey: ['rider-training'],
    queryFn: async () => {
      const { data } = await api.get('/riders/training');
      return (data.data ?? data) as TrainingResponse;
    },
  });

  const complete = useMutation({
    mutationFn: async (moduleKey: ModuleKey) => {
      const { data } = await api.post(`/riders/training/${moduleKey}/complete`);
      return data.data ?? data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rider-training'] }),
        queryClient.invalidateQueries({ queryKey: ['rider-onboarding-status'] }),
        queryClient.invalidateQueries({ queryKey: ['rider-profile'] }),
      ]);
      Toast.show({
        type: 'success',
        text1: 'Training recorded',
        text2: 'RiderGuy will verify this In-House module before activation.',
      });
      setSelectedModule(null);
    },
    onError: (error: any) => Toast.show({
      type: 'error',
      text1: error?.response?.data?.error?.message ?? 'Could not record training completion.',
    }),
  });

  const modules = training.data?.modules ?? [];
  const inHouse = training.data?.riderChannel === 'IN_HOUSE';
  const completed = modules.filter((module) => module.completedAt).length;
  const verified = modules.filter((module) => module.verifiedAt).length;
  const progress = modules.length ? (completed / modules.length) * 100 : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }} edges={['top', 'bottom']}>
      <RiderHeader
        title="Learning Center"
        subtitle={inHouse ? 'Required RiderGuy In-House training' : 'Practical modules for safer deliveries'}
        canGoBack
        right={<StatusPill status={inHouse ? (verified === modules.length && modules.length ? 'COMPLETED' : 'PENDING') : 'REGISTERED'} label={inHouse ? `${completed}/${modules.length || 3}` : 'Optional'} />}
      />
      <FlatList
        data={modules}
        keyExtractor={(item) => item.key}
        refreshControl={<RefreshControl refreshing={training.isRefetching} onRefresh={training.refetch} tintColor={riderColors.green} />}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32, flexGrow: 1 }}
        ListHeaderComponent={
          training.data ? (
            <RiderCard dark style={{ marginBottom: 2 }}>
              <Text style={{ color: riderColors.white, fontSize: 20, fontWeight: '900' }}>
                {inHouse ? 'RiderGuy training path' : 'Rider safety skills'}
              </Text>
              <Text style={{ color: '#B8C8BF', fontSize: 13, lineHeight: 19, marginTop: 7 }}>
                {inHouse
                  ? 'Review each lesson and record completion. RiderGuy must verify all three modules before In-House activation.'
                  : 'Guest riders can review these lessons at any time. They are optional and do not affect Guest activation.'}
              </Text>
              {inHouse ? (
                <>
                  <View style={{ marginTop: 16 }}>
                    <ProgressBar progress={progress} color={riderColors.green} />
                  </View>
                  <Text style={{ color: '#9EB1A7', fontSize: 10.5, lineHeight: 16, marginTop: 9 }}>
                    {completed} completed · {verified} admin verified
                  </Text>
                </>
              ) : null}
            </RiderCard>
          ) : null
        }
        ListEmptyComponent={
          training.isLoading ? (
            <ActivityIndicator color={riderColors.green} style={{ paddingVertical: 70 }} />
          ) : (
            <EmptyState
              icon="cloud-offline-outline"
              title="Training could not load"
              body="Reconnect and retry so your training status remains accurate."
              action={<RiderButton label="Retry" variant="light" onPress={() => void training.refetch()} />}
            />
          )
        }
        renderItem={({ item }) => {
          const content = LESSON_CONTENT[item.key];
          const status = item.verifiedAt ? 'Verified' : item.completedAt ? 'Awaiting verification' : inHouse ? 'Required' : 'Optional';
          return (
            <TouchableOpacity
              activeOpacity={0.84}
              onPress={() => setSelectedModule(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${status}`}
            >
              <RiderCard>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: content.color, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={content.icon} size={24} color={riderColors.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900' }}>{item.title}</Text>
                    <Text style={{ color: riderColors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 }} numberOfLines={2}>{item.description}</Text>
                    <Text style={{ color: item.verifiedAt ? riderColors.greenDark : item.completedAt ? '#9A5F05' : riderColors.soft, fontSize: 11, fontWeight: '800', marginTop: 5 }}>
                      {content.duration} · {status}
                    </Text>
                  </View>
                  <Ionicons name={item.verifiedAt ? 'shield-checkmark' : item.completedAt ? 'time' : 'play-circle-outline'} size={26} color={item.verifiedAt ? riderColors.greenDark : item.completedAt ? riderColors.amber : riderColors.soft} />
                </View>
              </RiderCard>
            </TouchableOpacity>
          );
        }}
      />

      <TrainingLessonModal
        inHouse={inHouse}
        loading={complete.isPending}
        module={selectedModule}
        onClose={() => setSelectedModule(null)}
        onComplete={(moduleKey) => complete.mutate(moduleKey)}
      />
    </SafeAreaView>
  );
}

function TrainingLessonModal({
  inHouse,
  loading,
  module,
  onClose,
  onComplete,
}: {
  inHouse: boolean;
  loading: boolean;
  module: TrainingRecord | null;
  onClose: () => void;
  onComplete: (moduleKey: ModuleKey) => void;
}) {
  if (!module) return null;
  const content = LESSON_CONTENT[module.key];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }} edges={['top', 'bottom']}>
        <View style={{ minHeight: 70, backgroundColor: riderColors.white, borderBottomWidth: 1, borderBottomColor: riderColors.line, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close lesson" style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: riderColors.panelAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={21} color={riderColors.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: riderColors.ink, fontSize: 18, fontWeight: '900' }} numberOfLines={1}>{module.title}</Text>
            <Text style={{ color: riderColors.muted, fontSize: 11, marginTop: 2 }}>{content.duration} lesson</Text>
          </View>
          {module.verifiedAt ? <StatusPill status="COMPLETED" label="Verified" /> : module.completedAt ? <StatusPill status="PENDING" label="In review" /> : null}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <RiderCard dark>
            <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: riderColors.green, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={content.icon} size={25} color={riderColors.white} />
            </View>
            <Text style={{ color: riderColors.white, fontSize: 20, fontWeight: '900', marginTop: 14 }}>What you will learn</Text>
            <Text style={{ color: '#B8C8BF', fontSize: 13, lineHeight: 20, marginTop: 7 }}>{content.objective}</Text>
          </RiderCard>

          <View style={{ gap: 10, marginTop: 14 }}>
            {content.lessons.map((lesson, index) => (
              <RiderCard key={lesson.title} style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: content.color, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: riderColors.ink, fontSize: 12, fontWeight: '900' }}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: riderColors.ink, fontSize: 14, fontWeight: '900' }}>{lesson.title}</Text>
                    <Text style={{ color: riderColors.muted, fontSize: 12.5, lineHeight: 19, marginTop: 5 }}>{lesson.body}</Text>
                  </View>
                </View>
              </RiderCard>
            ))}
          </View>

          <View style={{ borderRadius: 18, backgroundColor: riderColors.greenMist, borderWidth: 1, borderColor: '#CFECDD', padding: 16, marginTop: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <Ionicons name="checkmark-circle-outline" size={23} color={riderColors.greenDark} />
              <Text style={{ color: riderColors.ink, fontSize: 14, fontWeight: '900' }}>Safety checkpoint</Text>
            </View>
            <Text style={{ color: riderColors.muted, fontSize: 13, lineHeight: 20, marginTop: 8 }}>{content.checkpoint}</Text>
          </View>

          {!inHouse ? (
            <RiderButton label="Done reading" icon="checkmark" onPress={onClose} style={{ marginTop: 16 }} />
          ) : (
            <RiderButton
              label={module.verifiedAt ? 'Verified by RiderGuy' : module.completedAt ? 'Completed — awaiting verification' : 'I understand — record completion'}
              icon={module.verifiedAt ? 'shield-checkmark' : module.completedAt ? 'time' : 'checkmark'}
              loading={loading}
              disabled={Boolean(module.completedAt)}
              onPress={() => onComplete(module.key)}
              style={{ marginTop: 16 }}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
