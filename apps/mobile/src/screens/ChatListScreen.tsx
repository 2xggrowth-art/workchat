import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, ScrollView } from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { api } from '../services/api'
import { socketService } from '../services/socket'
import { useAuthStore } from '../stores/authStore'

interface Chat {
  id: string
  name: string
  type: 'DIRECT' | 'GROUP'
  lastMessage?: {
    content: string
    type: string
    createdAt: string
    senderName?: string
  }
  members?: Array<{
    userId: string
    user: {
      id: string
      name: string
    }
  }>
  updatedAt?: string
  createdAt?: string
  unreadCount?: number
}

const AVATAR_COLORS = ['#E91E63', '#9C27B0', '#3F51B5', '#009688', '#FF5722', '#795548', '#607D8B', '#2196F3']

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

type FilterType = 'all' | 'unread' | 'groups' | 'direct'

export default function ChatListScreen() {
  const navigation = useNavigation()
  const user = useAuthStore((state) => state.user)

  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')

  const fetchChats = async () => {
    try {
      const response = await api.get('/api/chats')
      const chatData = response.data.data || []
      setChats(chatData)
    } catch (error: any) {
      console.error('[ChatList] Failed to fetch chats:', error.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchChats()

    const unsubscribeNewMessage = socketService.on('new_message', () => {
      fetchChats()
    })
    const unsubscribeChatCreated = socketService.on('chat_created', () => {
      fetchChats()
    })
    const unsubscribeUnreadUpdated = socketService.on('unread_updated', (data: { chatId: string; unreadCount: number }) => {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === data.chatId ? { ...chat, unreadCount: data.unreadCount } : chat
        )
      )
    })
    const unsubscribeMessagesRead = socketService.on('messages_read', () => {
      fetchChats()
    })

    return () => {
      unsubscribeNewMessage()
      unsubscribeChatCreated()
      unsubscribeUnreadUpdated()
      unsubscribeMessagesRead()
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchChats()
    }, [])
  )

  const onRefresh = () => {
    setRefreshing(true)
    fetchChats()
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const getLastMessagePreview = (chat: Chat) => {
    if (!chat.lastMessage) return 'No messages yet'

    const { type, content, senderName } = chat.lastMessage
    const prefix = chat.type === 'GROUP' && senderName ? `${senderName}: ` : ''

    switch (type) {
      case 'IMAGE':
        return prefix + 'Photo'
      case 'VIDEO':
        return prefix + 'Video'
      case 'AUDIO':
        return prefix + 'Audio'
      case 'FILE':
        return prefix + 'File'
      default:
        return prefix + (content || '')
    }
  }

  const getChatDisplayName = (chat: Chat) => {
    if (chat.type === 'GROUP') return chat.name
    const otherMember = chat.members?.find((m) => m.user.id !== user?.id)
    return otherMember?.user.name || chat.name
  }

  const filteredChats = chats.filter((chat) => {
    switch (filter) {
      case 'unread':
        return (chat.unreadCount || 0) > 0
      case 'groups':
        return chat.type === 'GROUP'
      case 'direct':
        return chat.type === 'DIRECT'
      default:
        return true
    }
  })

  const renderFilterChip = (label: string, value: FilterType) => (
    <TouchableOpacity
      key={value}
      style={[styles.filterChip, filter === value && styles.filterChipActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[styles.filterChipText, filter === value && styles.filterChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  )

  const renderChat = ({ item }: { item: Chat }) => {
    const hasUnread = (item.unreadCount || 0) > 0
    const displayName = getChatDisplayName(item)
    const avatarColor = getAvatarColor(displayName)

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => (navigation as any).navigate('Chat', { chatId: item.id, chatName: displayName })}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          {item.type === 'GROUP' ? (
            <Text style={styles.avatarText}>G</Text>
          ) : (
            <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
          )}
        </View>
        <View style={styles.chatInfo}>
          <Text style={[styles.chatName, hasUnread && styles.chatNameUnread]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.chatPreview, hasUnread && styles.chatPreviewUnread]} numberOfLines={1}>
            {getLastMessagePreview(item)}
          </Text>
        </View>
        <View style={styles.chatMeta}>
          <Text style={[styles.chatTime, hasUnread && styles.chatTimeUnread]}>
            {item.lastMessage?.createdAt
              ? formatTime(item.lastMessage.createdAt)
              : item.updatedAt
              ? formatTime(item.updatedAt)
              : ''}
          </Text>
          {hasUnread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {item.unreadCount! > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No chats yet</Text>
      <Text style={styles.emptySubtitle}>Start a conversation to see it here</Text>
    </View>
  )

  return (
    <View style={styles.container}>
      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterBarContent}>
        {renderFilterChip('All', 'all')}
        {renderFilterChip('Unread', 'unread')}
        {renderFilterChip('Groups', 'groups')}
        {renderFilterChip('Direct', 'direct')}
      </ScrollView>

      {/* Chat List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#128C7E" />
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          renderItem={renderChat}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, filteredChats.length === 0 && styles.listContentEmpty]}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#128C7E" />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => (navigation as any).navigate('NewChat')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  filterBar: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    flexGrow: 0,
  },
  filterBarContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#EEEEEE',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#128C7E',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#616161',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 80,
  },
  listContentEmpty: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  chatInfo: {
    flex: 1,
    minWidth: 0,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
  },
  chatNameUnread: {
    fontWeight: '700',
  },
  chatPreview: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 2,
  },
  chatPreviewUnread: {
    color: '#424242',
    fontWeight: '500',
  },
  chatMeta: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  chatTime: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  chatTimeUnread: {
    color: '#25D366',
    fontWeight: '500',
  },
  badge: {
    backgroundColor: '#25D366',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginTop: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  fabIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
  },
})
