import { useMemo, useState } from 'react';
import { Modal, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import Toast from 'react-native-toast-message';
import {
  EmptyState,
  RiderButton,
  RiderCard,
  RiderHeader,
  RiderTextField,
  StatusPill,
} from '@/components/rider-ui';
import { initials, riderColors } from '@/lib/rider-design';

type MentorshipStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
type RiderSummary = {
  id: string;
  user?: { firstName?: string; lastName?: string };
  currentLevel?: number;
  totalDeliveries?: number;
  averageRating?: number;
};
type Mentorship = {
  id: string;
  status: MentorshipStatus;
  mentor?: RiderSummary;
  mentee?: RiderSummary;
  completionNote?: string | null;
  _count?: { checkIns?: number };
};
type MyMentorship = Mentorship & { participantRole: 'mentor' | 'mentee' };

function statusLabel(status: MentorshipStatus) {
  if (status === 'PENDING') return 'Awaiting acceptance';
  if (status === 'ACTIVE') return 'Active';
  if (status === 'COMPLETED') return 'Completed';
  return 'Cancelled';
}

export default function MentorshipScreen() {
  const { api } = useAuth();
  const qc = useQueryClient();
  const [checkInTarget, setCheckInTarget] = useState<MyMentorship | null>(null);
  const [checkInNote, setCheckInNote] = useState('');

  const mentors = useQuery({
    queryKey: ['mentors'],
    queryFn: async () => {
      const { data } = await api.get('/mentorship/mentors?limit=30');
      const payload = data.data ?? data;
      return (payload.mentors ?? payload) as RiderSummary[];
    },
  });

  const mine = useQuery({
    queryKey: ['mentorship-mine'],
    queryFn: async () => {
      const { data } = await api.get('/mentorship/mine');
      return (data.data ?? data) as { asMentor?: Mentorship[]; asMentee?: Mentorship[] };
    },
  });

  const myMentorships = useMemo<MyMentorship[]>(() => {
    const asMentor = (mine.data?.asMentor ?? []).map((item) => ({
      ...item,
      participantRole: 'mentor' as const,
    }));
    const asMentee = (mine.data?.asMentee ?? []).map((item) => ({
      ...item,
      participantRole: 'mentee' as const,
    }));
    const order: Record<MentorshipStatus, number> = {
      ACTIVE: 0,
      PENDING: 1,
      COMPLETED: 2,
      CANCELLED: 3,
    };
    return [...asMentor, ...asMentee].sort(
      (left, right) => order[left.status] - order[right.status],
    );
  }, [mine.data]);

  const current = myMentorships.filter(
    (item) => item.status === 'ACTIVE' || item.status === 'PENDING',
  );
  const existingMentorIds = new Set(
    myMentorships
      .filter((item) => item.participantRole === 'mentee' && item.status !== 'CANCELLED')
      .map((item) => item.mentor?.id)
      .filter(Boolean),
  );

  const request = useMutation({
    mutationFn: async (mentorId: string) => api.post('/mentorship/request', { mentorId }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['mentorship-mine'] }),
        qc.invalidateQueries({ queryKey: ['mentors'] }),
      ]);
      Toast.show({
        type: 'success',
        text1: 'Mentorship request sent',
        text2: 'The mentor or RiderGuy team can now activate it.',
      });
    },
    onError: (error: any) =>
      Toast.show({
        type: 'error',
        text1: error?.response?.data?.error?.message ?? 'Could not request mentorship.',
      }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      completionNote,
    }: {
      id: string;
      status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
      completionNote?: string;
    }) => api.patch(`/mentorship/${id}/status`, { status, completionNote }),
    onSuccess: async (_response, variables) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['mentorship-mine'] }),
        qc.invalidateQueries({ queryKey: ['mentors'] }),
      ]);
      const labels = {
        ACTIVE: 'Mentorship accepted',
        COMPLETED: 'Mentorship completed',
        CANCELLED: 'Mentorship cancelled',
      };
      Toast.show({ type: 'success', text1: labels[variables.status] });
    },
    onError: (error: any) =>
      Toast.show({
        type: 'error',
        text1: error?.response?.data?.error?.message ?? 'Could not update mentorship.',
      }),
  });

  const addCheckIn = useMutation({
    mutationFn: async () => {
      if (!checkInTarget) return;
      await api.post(`/mentorship/${checkInTarget.id}/check-ins`, {
        note: checkInNote.trim(),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mentorship-mine'] });
      setCheckInTarget(null);
      setCheckInNote('');
      Toast.show({ type: 'success', text1: 'Check-in recorded' });
    },
    onError: (error: any) =>
      Toast.show({
        type: 'error',
        text1: error?.response?.data?.error?.message ?? 'Could not save the check-in.',
      }),
  });

  const refresh = async () => {
    await Promise.all([mentors.refetch(), mine.refetch()]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader
        title="Mentorship"
        subtitle="Guidance, progress, and shared accountability"
        canGoBack
        right={
          <StatusPill
            status={current.some((item) => item.status === 'ACTIVE') ? 'ONLINE' : 'PENDING'}
            label={`${current.length} current`}
          />
        }
      />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={mentors.isRefetching || mine.isRefetching}
            onRefresh={refresh}
            tintColor={riderColors.green}
          />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 34 }}
        showsVerticalScrollIndicator={false}
      >
        <RiderCard dark style={{ marginBottom: 18 }}>
          <Text style={{ color: riderColors.white, fontSize: 20, fontWeight: '900' }}>
            Grow with another Rider.
          </Text>
          <Text style={{ color: '#B8C8BF', fontSize: 13, lineHeight: 20, marginTop: 8 }}>
            Request a proven mentor, manage the relationship here, and record practical check-ins
            while you learn.
          </Text>
        </RiderCard>

        <SectionTitle title="Your mentorships" detail={`${myMentorships.length} total`} />
        {mine.isLoading ? (
          <InfoCard body="Loading your mentorships…" />
        ) : myMentorships.length === 0 ? (
          <InfoCard body="No mentorship yet. Choose a mentor below; requests and RiderGuy administrator decisions will appear here." />
        ) : (
          <View style={{ gap: 10, marginBottom: 20 }}>
            {myMentorships.map((mentorship) => {
              const counterpart =
                mentorship.participantRole === 'mentor' ? mentorship.mentee : mentorship.mentor;
              const firstName = counterpart?.user?.firstName ?? 'Rider';
              const lastName = counterpart?.user?.lastName ?? '';
              const busy = updateStatus.isPending && updateStatus.variables?.id === mentorship.id;

              return (
                <RiderCard key={`${mentorship.participantRole}-${mentorship.id}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 17,
                        backgroundColor:
                          mentorship.status === 'ACTIVE'
                            ? riderColors.greenSoft
                            : riderColors.violetSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900' }}>
                        {initials(firstName, lastName)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900' }}>
                        {firstName} {lastName}
                      </Text>
                      <Text style={{ color: riderColors.muted, fontSize: 11.5, marginTop: 3 }}>
                        You are the {mentorship.participantRole} ·{' '}
                        {mentorship._count?.checkIns ?? 0} check-ins
                      </Text>
                    </View>
                    <StatusPill status={mentorship.status} label={statusLabel(mentorship.status)} />
                  </View>

                  {mentorship.completionNote ? (
                    <View
                      style={{
                        marginTop: 11,
                        borderRadius: 13,
                        backgroundColor: riderColors.panelAlt,
                        padding: 11,
                      }}
                    >
                      <Text style={{ color: riderColors.muted, fontSize: 11.5, lineHeight: 17 }}>
                        {mentorship.completionNote}
                      </Text>
                    </View>
                  ) : null}

                  {mentorship.status === 'PENDING' && mentorship.participantRole === 'mentor' ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                      <RiderButton
                        label="Accept"
                        icon="checkmark-circle"
                        loading={busy && updateStatus.variables?.status === 'ACTIVE'}
                        disabled={busy}
                        onPress={() => updateStatus.mutate({ id: mentorship.id, status: 'ACTIVE' })}
                        style={{ flex: 1 }}
                      />
                      <RiderButton
                        label="Decline"
                        variant="ghost"
                        disabled={busy}
                        onPress={() =>
                          updateStatus.mutate({
                            id: mentorship.id,
                            status: 'CANCELLED',
                            completionNote: 'Declined by mentor.',
                          })
                        }
                        style={{ flex: 1 }}
                      />
                    </View>
                  ) : mentorship.status === 'PENDING' ? (
                    <RiderButton
                      label="Cancel Request"
                      variant="ghost"
                      loading={busy}
                      onPress={() =>
                        updateStatus.mutate({
                          id: mentorship.id,
                          status: 'CANCELLED',
                          completionNote: 'Cancelled by mentee.',
                        })
                      }
                      style={{ marginTop: 12 }}
                    />
                  ) : mentorship.status === 'ACTIVE' ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                      <RiderButton
                        label="Add Check-in"
                        icon="create-outline"
                        variant="light"
                        disabled={busy}
                        onPress={() => setCheckInTarget(mentorship)}
                        style={{ flexGrow: 1 }}
                      />
                      <RiderButton
                        label="Complete"
                        icon="checkmark-done"
                        disabled={busy}
                        onPress={() =>
                          updateStatus.mutate({ id: mentorship.id, status: 'COMPLETED' })
                        }
                        style={{ flexGrow: 1 }}
                      />
                      <RiderButton
                        label="Cancel"
                        variant="ghost"
                        disabled={busy}
                        onPress={() =>
                          updateStatus.mutate({ id: mentorship.id, status: 'CANCELLED' })
                        }
                        style={{ flexGrow: 1 }}
                      />
                    </View>
                  ) : null}
                </RiderCard>
              );
            })}
          </View>
        )}

        <SectionTitle title="Available mentors" detail="Verified top Riders" />
        {mentors.isLoading ? (
          <InfoCard body="Finding available mentors…" />
        ) : (mentors.data ?? []).length === 0 ? (
          <EmptyState
            icon="school-outline"
            title="No mentors available"
            body="Eligible top Riders will appear here when mentorship places are available."
          />
        ) : (
          <View style={{ gap: 10 }}>
            {(mentors.data ?? []).map((mentor) => {
              const first = mentor.user?.firstName ?? 'Rider';
              const last = mentor.user?.lastName ?? '';
              const alreadyRequested = existingMentorIds.has(mentor.id);
              const requesting = request.isPending && request.variables === mentor.id;
              return (
                <RiderCard key={mentor.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: 19,
                        backgroundColor: riderColors.violetSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: riderColors.violet, fontSize: 17, fontWeight: '900' }}>
                        {initials(first, last)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900' }}>
                        {first} {last}
                      </Text>
                      <Text style={{ color: riderColors.muted, fontSize: 11.5, marginTop: 3 }}>
                        Level {mentor.currentLevel ?? 3} · {mentor.totalDeliveries ?? 0} deliveries
                      </Text>
                      <Text
                        style={{
                          color: riderColors.amber,
                          fontSize: 11.5,
                          fontWeight: '800',
                          marginTop: 4,
                        }}
                      >
                        ★ {Number(mentor.averageRating ?? 0).toFixed(1)}
                      </Text>
                    </View>
                    <RiderButton
                      label={alreadyRequested ? 'Requested' : 'Request'}
                      loading={requesting}
                      disabled={alreadyRequested || request.isPending}
                      onPress={() => request.mutate(mentor.id)}
                      style={{ minHeight: 42, borderRadius: 14 }}
                    />
                  </View>
                </RiderCard>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={Boolean(checkInTarget)}
        animationType="slide"
        transparent
        onRequestClose={() => setCheckInTarget(null)}
      >
        <SafeAreaView
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,17,13,0.58)' }}
          edges={['bottom']}
        >
          <View
            style={{
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              backgroundColor: riderColors.white,
              padding: 18,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <View>
                <Text style={{ color: riderColors.ink, fontSize: 20, fontWeight: '900' }}>
                  Mentorship check-in
                </Text>
                <Text style={{ color: riderColors.muted, fontSize: 11.5, marginTop: 3 }}>
                  Shared with your mentorship record
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close check-in"
                onPress={() => setCheckInTarget(null)}
              >
                <Ionicons name="close" size={25} color={riderColors.ink} />
              </TouchableOpacity>
            </View>
            <RiderTextField
              label="What did you work on?"
              placeholder="Record progress, a lesson, or the next action."
              value={checkInNote}
              onChangeText={setCheckInNote}
              multiline
              inputStyle={{ minHeight: 112, textAlignVertical: 'top', paddingTop: 12 }}
            />
            <RiderButton
              label="Save Check-in"
              icon="checkmark-circle-outline"
              loading={addCheckIn.isPending}
              disabled={checkInNote.trim().length < 3}
              onPress={() => addCheckIn.mutate()}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function SectionTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 9 }}>
      <Text style={{ flex: 1, color: riderColors.ink, fontSize: 17, fontWeight: '900' }}>
        {title}
      </Text>
      <Text style={{ color: riderColors.muted, fontSize: 11.5, fontWeight: '800' }}>{detail}</Text>
    </View>
  );
}

function InfoCard({ body }: { body: string }) {
  return (
    <RiderCard style={{ marginBottom: 18 }}>
      <Text style={{ color: riderColors.muted, fontSize: 12, lineHeight: 18 }}>{body}</Text>
    </RiderCard>
  );
}
