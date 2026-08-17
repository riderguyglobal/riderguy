import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { io, type Socket } from 'socket.io-client';
import Toast from 'react-native-toast-message';
import { tokenStorage, useAuth } from '@riderguy/auth-native';
import { EmptyState, ScreenHeader } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';

const SOCKET_URL = (process.env.EXPO_PUBLIC_SOCKET_URL ?? 'https://api.myriderguy.com')
  .replace('api.riderguy.com', 'api.myriderguy.com')
  .replace(/\/+$/, '');

type Message = {
  id: string;
  orderId?: string;
  senderId: string;
  senderName?: string;
  senderRole?: 'client' | 'rider';
  content: string;
  timestamp?: string;
  createdAt?: string;
};

function messageTime(message: Message) {
  const value = message.timestamp ?? message.createdAt;
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function OrderChatScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { api, user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    let disposed = false;

    async function load() {
      try {
        const [{ data }, token] = await Promise.all([
          api.get(`/orders/${orderId}/messages`, { params: { limit: 100 } }),
          tokenStorage.getAccessToken(),
        ]);
        if (disposed) return;
        setMessages((data.data ?? data) as Message[]);

        const socket = io(SOCKET_URL, {
          transports: ['websocket', 'polling'],
          auth: { token },
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          setConnected(true);
          socket.emit('order:subscribe', { orderId });
        });
        socket.on('disconnect', () => setConnected(false));
        socket.on('message:new', (message: Message) => {
          if (message.orderId && message.orderId !== orderId) return;
          setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
          requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
        });
        socket.on('connect_error', () => setConnected(false));
      } catch (error: any) {
        Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Could not open chat' });
      }
    }

    load();
    return () => {
      disposed = true;
      socketRef.current?.emit('order:unsubscribe', { orderId });
      socketRef.current?.disconnect();
    };
  }, [api, orderId]);

  const send = () => {
    const content = text.trim();
    if (!content || !socketRef.current) return;
    socketRef.current.emit('message:send', { orderId, content }, (ack?: { success: boolean }) => {
      if (!ack?.success) Toast.show({ type: 'error', text1: 'Message was not sent' });
    });
    setText('');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ScreenHeader
        title="Order Chat"
        subtitle={connected ? 'Connected to rider channel' : 'Reconnecting...'}
        right={
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: connected ? colors.brand : colors.amber, marginRight: 4 }} />
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 18, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <EmptyState icon="chatbubble-ellipses-outline" title="No messages yet" body="Use this channel for pickup notes, arrival updates, and delivery clarifications." />
          }
          renderItem={({ item }) => {
            const isMine = item.senderId === user?.id;
            return (
              <View style={{ maxWidth: '82%', alignSelf: isMine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                {!isMine && !!item.senderName && (
                  <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: '900', marginBottom: 4, marginLeft: 4 }}>{item.senderName}</Text>
                )}
                <View
                  style={{
                    borderRadius: 20,
                    borderBottomRightRadius: isMine ? 6 : 20,
                    borderBottomLeftRadius: isMine ? 20 : 6,
                    backgroundColor: isMine ? colors.brand : '#fff',
                    borderWidth: isMine ? 0 : 1,
                    borderColor: '#EEF2F7',
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    ...(isMine ? shadow.brand : shadow.card),
                  }}
                >
                  <Text style={{ color: isMine ? '#fff' : colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '700' }}>{item.content}</Text>
                </View>
                <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: '700', marginTop: 4, marginHorizontal: 5, textAlign: isMine ? 'right' : 'left' }}>
                  {messageTime(item)}
                </Text>
              </View>
            );
          }}
        />

        <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#EEF2F7', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message your rider..."
            placeholderTextColor={colors.subtle}
            multiline
            style={{ flex: 1, maxHeight: 110, minHeight: 46, borderRadius: 18, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#EEF2F7', paddingHorizontal: 14, paddingVertical: 11, color: colors.ink, fontSize: 14, fontWeight: '700' }}
          />
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={send}
            disabled={!text.trim() || !connected}
            style={{ width: 46, height: 46, borderRadius: 18, backgroundColor: text.trim() && connected ? colors.brand : '#D1D5DB', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
