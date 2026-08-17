import { useState } from 'react';
import { FlatList, Modal, Text, TouchableOpacity, View, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import Toast from 'react-native-toast-message';
import { EmptyState, RiderButton, RiderCard, RiderHeader, RiderTextField, SegmentedControl, StatusPill } from '@/components/rider-ui';
import { compactDate, initials, riderColors } from '@/lib/rider-design';

type Sort = 'newest' | 'trending' | 'top';

export default function ForumScreen() {
  const { api } = useAuth();
  const qc = useQueryClient();
  const [sort, setSort] = useState<Sort>('newest');
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['forum-posts', sort],
    queryFn: async () => {
      const { data } = await api.get(`/community/forum/posts?limit=30&sort=${sort}`);
      const payload = data.data ?? data;
      return payload.posts ?? payload;
    },
  });

  const createPost = useMutation({
    mutationFn: async () => api.post('/community/forum/posts', { title: title.trim(), body: body.trim(), category: 'GENERAL' }),
    onSuccess: async () => {
      setComposerOpen(false);
      setTitle('');
      setBody('');
      await qc.invalidateQueries({ queryKey: ['forum-posts'] });
      Toast.show({ type: 'success', text1: 'Post published.' });
    },
    onError: (error: any) => Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Could not publish.' }),
  });

  const vote = useMutation({
    mutationFn: async ({ postId, value }: { postId: string; value: 1 | -1 }) => api.post(`/community/forum/posts/${postId}/vote`, { value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forum-posts'] }),
  });

  const posts = (data ?? []) as any[];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader
        title="Rider forum"
        subtitle="Ask, warn, share, improve"
        canGoBack
        right={<TouchableOpacity onPress={() => setComposerOpen(true)} style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: riderColors.green, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="add" size={24} color={riderColors.white} /></TouchableOpacity>}
      />
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <SegmentedControl
          value={sort}
          onChange={setSort}
          options={[
            { label: 'New', value: 'newest' },
            { label: 'Hot', value: 'trending' },
            { label: 'Top', value: 'top' },
          ]}
        />
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={riderColors.green} />}
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 12, paddingBottom: 32 }}
        ListEmptyComponent={!isLoading ? <EmptyState icon="newspaper-outline" title="No posts yet" body="Start the first useful rider discussion in this space." /> : null}
        renderItem={({ item }) => (
          <RiderCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: riderColors.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: riderColors.greenDark, fontWeight: '900' }}>{initials(item.author?.firstName, item.author?.lastName)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: riderColors.ink, fontSize: 13, fontWeight: '900' }}>{item.author?.firstName ?? 'Rider'} {item.author?.lastName ?? ''}</Text>
                <Text style={{ color: riderColors.muted, fontSize: 11, marginTop: 2 }}>{compactDate(item.createdAt)}</Text>
              </View>
              {item.isPinned ? <StatusPill status="ONLINE" label="Pinned" /> : null}
            </View>
            <Text style={{ color: riderColors.ink, fontSize: 17, fontWeight: '900' }}>{item.title}</Text>
            <Text style={{ color: riderColors.muted, fontSize: 13, lineHeight: 20, marginTop: 7 }} numberOfLines={3}>{item.body}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity onPress={() => vote.mutate({ postId: item.id, value: 1 })} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: riderColors.panelAlt, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 }}>
                <Ionicons name="arrow-up" size={15} color={riderColors.greenDark} />
                <Text style={{ color: riderColors.ink, fontWeight: '900', fontSize: 12 }}>{item.upvotes ?? item.score ?? 0}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: riderColors.panelAlt, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 }}>
                <Ionicons name="chatbubble-outline" size={15} color={riderColors.muted} />
                <Text style={{ color: riderColors.ink, fontWeight: '900', fontSize: 12 }}>{item.commentCount ?? item._count?.comments ?? 0}</Text>
              </View>
            </View>
          </RiderCard>
        )}
      />

      <Modal visible={composerOpen} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,17,31,0.58)' }}>
          <View style={{ backgroundColor: riderColors.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: riderColors.ink, fontSize: 20, fontWeight: '900' }}>New forum post</Text>
              <TouchableOpacity onPress={() => setComposerOpen(false)}><Ionicons name="close" size={24} color={riderColors.ink} /></TouchableOpacity>
            </View>
            <RiderTextField label="Title" placeholder="What should riders know?" value={title} onChangeText={setTitle} />
            <RiderTextField label="Body" placeholder="Share the details" value={body} onChangeText={setBody} multiline inputStyle={{ minHeight: 112, textAlignVertical: 'top', paddingTop: 12 }} />
            <RiderButton label="Publish" icon="send" loading={createPost.isPending} disabled={!title.trim() || !body.trim()} onPress={() => createPost.mutate()} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
