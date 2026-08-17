import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokenStorage, useAuth } from '@riderguy/auth-native';
import { io, type Socket } from 'socket.io-client';
import Toast from 'react-native-toast-message';
import { RiderHeader, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

const SOCKET_URL = (process.env.EXPO_PUBLIC_SOCKET_URL ?? 'https://api.myriderguy.com')
  .replace('api.riderguy.com', 'api.myriderguy.com')
  .replace(/\/+$/, '');

interface Message {
  id: string;
  orderId?: string;
  senderId: string;
  senderName: string;
  senderRole?: 'client' | 'rider';
  content: string;
  timestamp?: string;
  createdAt?: string;
}

function messageTime(message: Message) {
  const value = message.timestamp ?? message.createdAt;
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function RiderOrderChatScreen() {
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
          setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
          requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
        });
        socket.on('connect_error', () => setConnected(false));
      } catch (error: any) {
        Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Could not open chat.' });
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
    const socket = socketRef.current;
    if (!content || !socket) return;
    socket.emit('message:send', { orderId, content }, (ack?: { success: boolean }) => {
      if (!ack?.success) Toast.show({ type: 'error', text1: 'Message was not sent.' });
    });
    setText('');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }} edges={['top']}>
      <RiderHeader
        title="Order chat"
        subtitle={connected ? 'Connected to customer' : 'Reconnecting...'}
        canGoBack
        right={<StatusPill status={connected ? 'ONLINE' : 'PENDING'} label={`${messages.length}`} />}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMine = item.senderId === user?.id;
            return (
              <View style={{ maxWidth: '84%', alignSelf: isMine ? 'flex-end' : 'flex-start' }}>
                {!isMine ? (
                  <Text style={{ color: riderColors.muted, fontSize: 11, fontWeight: '800', marginBottom: 4, paddingHorizontal: 4 }}>
                    {item.senderName || 'Customer'}
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
                  <Text style={{ color: isMine ? riderColors.white : riderColors.ink, fontSize: 14, lineHeight: 20 }}>{item.content}</Text>
                  {messageTime(item) ? (
                    <Text style={{ color: isMine ? '#D7FBE8' : riderColors.muted, fontSize: 10, fontWeight: '800', marginTop: 5 }}>
                      {messageTime(item)}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
        <View style={{ backgroundColor: riderColors.white, borderTopWidth: 1, borderTopColor: riderColors.line, padding: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder="Message the customer"
            placeholderTextColor={riderColors.soft}
            style={{ flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 16, borderWidth: 1, borderColor: riderColors.line, backgroundColor: riderColors.panelAlt, paddingHorizontal: 13, paddingVertical: 10, color: riderColors.ink, fontWeight: '700' }}
          />
          <TouchableOpacity onPress={send} disabled={!text.trim()} style={{ width: 46, height: 46, borderRadius: 17, backgroundColor: text.trim() ? riderColors.green : '#cbd5e1', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="send" size={18} color={riderColors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
