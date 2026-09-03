import { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import Toast from 'react-native-toast-message';
import { RiderButton, RiderCard, RiderTextField } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

export type CommunityReportTarget = {
  entityType: 'chat_message' | 'forum_post' | 'forum_comment';
  entityId: string;
  label: string;
};

const REASONS = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'HATE_SPEECH', label: 'Hate speech' },
  { value: 'MISINFORMATION', label: 'Misinformation' },
  { value: 'INAPPROPRIATE', label: 'Inappropriate' },
  { value: 'SCAM', label: 'Scam' },
  { value: 'OTHER', label: 'Other' },
] as const;

type ReportReason = (typeof REASONS)[number]['value'];

export function CommunityReportModal({
  target,
  onClose,
}: {
  target: CommunityReportTarget | null;
  onClose: () => void;
}) {
  const { api } = useAuth();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!target) {
      setReason(null);
      setDescription('');
    }
  }, [target]);

  const report = useMutation({
    mutationFn: async () => {
      if (!target || !reason) return;
      await api.post('/community/reports', {
        entityType: target.entityType,
        entityId: target.entityId,
        reason,
        ...(description.trim() ? { description: description.trim() } : {}),
      });
    },
    onSuccess: () => {
      Toast.show({
        type: 'success',
        text1: 'Report sent to RiderGuy',
        text2: 'The trust and safety team will review it.',
      });
      onClose();
    },
    onError: (error: any) => {
      Toast.show({
        type: 'error',
        text1:
          error?.response?.data?.error?.message ?? 'The report could not be sent. Please retry.',
      });
    },
  });

  return (
    <Modal visible={Boolean(target)} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,17,13,0.58)' }}
        edges={['bottom']}
      >
        <View
          style={{
            maxHeight: '88%',
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            backgroundColor: riderColors.white,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              minHeight: 68,
              paddingHorizontal: 18,
              borderBottomWidth: 1,
              borderBottomColor: riderColors.line,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 15,
                backgroundColor: riderColors.redSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="flag" size={20} color={riderColors.red} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: riderColors.ink, fontSize: 18, fontWeight: '900' }}>
                Report content
              </Text>
              <Text style={{ color: riderColors.muted, fontSize: 11.5, marginTop: 2 }}>
                {target?.label ?? 'Community content'}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close report form"
              onPress={onClose}
              disabled={report.isPending}
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                backgroundColor: riderColors.panelAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={22} color={riderColors.ink} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 28 }}>
            <RiderCard style={{ marginBottom: 14 }}>
              <Text style={{ color: riderColors.ink, fontSize: 14, fontWeight: '900' }}>
                Why are you reporting this?
              </Text>
              <Text
                style={{ color: riderColors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}
              >
                Reports go directly to the RiderGuy administrator moderation queue. The author is
                not told who submitted the report.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 }}>
                {REASONS.map((option) => {
                  const selected = reason === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setReason(option.value)}
                      style={{
                        minHeight: 42,
                        borderRadius: 13,
                        borderWidth: 1,
                        borderColor: selected ? riderColors.greenDark : riderColors.line,
                        backgroundColor: selected ? riderColors.greenSoft : riderColors.white,
                        paddingHorizontal: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? riderColors.greenDark : riderColors.ink,
                          fontSize: 12,
                          fontWeight: '800',
                        }}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </RiderCard>

            <RiderTextField
              label="Extra detail (optional)"
              placeholder="Share only facts that help the team review this content."
              value={description}
              onChangeText={setDescription}
              multiline
              inputStyle={{ minHeight: 96, textAlignVertical: 'top', paddingTop: 12 }}
            />
            <RiderButton
              label="Send Report"
              icon="shield-checkmark-outline"
              loading={report.isPending}
              disabled={!reason || report.isPending}
              onPress={() => report.mutate()}
            />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
