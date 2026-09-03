import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokenStorage, useAuth } from '@riderguy/auth-native';
import { io, type Socket } from 'socket.io-client';
import Toast from 'react-native-toast-message';
import { RiderHeader, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';
import {
  CommunityReportModal,
  type CommunityReportTarget,
} from '@/components/community-report-modal';

const SOCKET_URL = (process.env.EXPO_PUBLIC_SOCKET_URL ?? 'https://api.myriderguy.com')
  .replace('api.riderguy.com', 'api.myriderguy.com')
  .replace(/\/+$/, '');

interface Message {
  id: string;
  roomId?: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

export default function CommunityChatScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { api, user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [reportTarget, setReportTarget] = useState<CommunityReportTarget | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    let mounted = true;
    const start = async () => {
      try {
        const [{ data }, token] = await Promise.all([
          api.get(`/community/chat/rooms/${roomId}/messages?limit=50`),
          tokenStorage.getAccessToken(),
        ]);
        const payload = data.data ?? data;
        const initial = Array.isArray(payload) ? payload : (payload.messages ?? []);
        if (mounted) setMessages([...initial].reverse());
        await api.put(`/community/chat/rooms/${roomId}/read`).catch(() => {});

        const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'], auth: { token } });
        socket.on('connect', () => socket.emit('community:join', { roomId }));
        socket.on('community:message', (msg: Message) => {
          if (msg.roomId && msg.roomId !== roomId) return;
          setMessages((current) => [...current, msg]);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
        });
        socketRef.current = socket;
      } catch (error: any) {
        Toast.show({
          type: 'error',
          text1: error?.response?.data?.error?.message ?? 'Could not open room.',
        });
      }
    };
    start();
    return () => {
      mounted = false;
      socketRef.current?.emit('community:leave', { roomId });
      socketRef.current?.disconnect();
    };
  }, [api, roomId]);

  const send = async () => {
    const content = text.trim();
    if (!content) return;
    setText('');
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit('community:send', { roomId, content }, (ack: { success: boolean }) => {
        if (!ack?.success) Toast.show({ type: 'error', text1: 'Message failed.' });
      });
    } else {
      try {
        const { data } = await api.post(`/community/chat/rooms/${roomId}/messages`, { content });
        setMessages((current) => [...current, data.data ?? data]);
      } catch {
        Toast.show({ type: 'error', text1: 'Message failed.' });
      }
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader
        title="Crew room"
        subtitle="Live rider chat"
        canGoBack
        right={<StatusPill status="ONLINE" label={`${messages.length}`} />}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMine = item.senderId === user?.id;
            return (
              <View style={{ maxWidth: '82%', alignSelf: isMine ? 'flex-end' : 'flex-start' }}>
                {!isMine ? (
                  <Text
                    style={{
                      color: riderColors.muted,
                      fontSize: 11,
                      fontWeight: '800',
                      marginBottom: 4,
                      paddingHorizontal: 4,
                    }}
                  >
                    {item.senderName}
                  </Text>
                ) : null}
                <View
                  style={{
                    backgroundColor: isMine ? riderColors.green : riderColors.white,
                    borderRadius: 18,
                    borderBottomRightRadius: isMine ? 5 : 18,
                    borderBottomLeftRadius: isMine ? 18 : 5,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderWidth: isMine ? 0 : 1,
                    borderColor: riderColors.line,
                  }}
                >
                  <Text
                    style={{
                      color: isMine ? riderColors.white : riderColors.ink,
                      fontSize: 14,
                      lineHeight: 20,
                    }}
                  >
                    {item.content}
                  </Text>
                </View>
                {!isMine ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Report message from ${item.senderName}`}
                    onPress={() =>
                      setReportTarget({
                        entityType: 'chat_message',
                        entityId: item.id,
                        label: `Message from ${item.senderName || 'Rider'}`,
                      })
                    }
                    style={{
                      minHeight: 36,
                      alignSelf: 'flex-start',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 5,
                    }}
                  >
                    <Ionicons name="flag-outline" size={13} color={riderColors.soft} />
                    <Text style={{ color: riderColors.soft, fontSize: 10.5, fontWeight: '700' }}>
                      Report
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          }}
        />
        <View
          style={{
            backgroundColor: riderColors.white,
            borderTopWidth: 1,
            borderTopColor: riderColors.line,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 10,
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder="Message the room"
            placeholderTextColor={riderColors.soft}
            style={{
              flex: 1,
              minHeight: 44,
              maxHeight: 110,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: riderColors.line,
              backgroundColor: riderColors.panelAlt,
              paddingHorizontal: 13,
              paddingVertical: 10,
              color: riderColors.ink,
              fontWeight: '700',
            }}
          />
          <TouchableOpacity
            onPress={send}
            disabled={!text.trim()}
            style={{
              width: 46,
              height: 46,
              borderRadius: 17,
              backgroundColor: text.trim() ? riderColors.green : '#cbd5e1',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="send" size={18} color={riderColors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <CommunityReportModal target={reportTarget} onClose={() => setReportTarget(null)} />
    </SafeAreaView>
  );
}
