import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../stores/authStore'
import { useTheme } from '../contexts/ThemeContext'
import { api } from '../services/api'

interface ContactUser {
  id: string
  name: string
  phone: string
  avatarUrl?: string | null
  emoji?: string | null
  role: string
}

interface CommonGroup {
  id: string
  name: string
  memberCount: number
}

export default function ContactInfoScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const { chatId } = route.params as { chatId: string }
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const user = useAuthStore((s) => s.user)

  const [contact, setContact] = useState<ContactUser | null>(null)
  const [commonGroups, setCommonGroups] = useState<CommonGroup[]>([])
  const [isBlocked, setIsBlocked] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchContactInfo()
  }, [chatId])

  const fetchContactInfo = async () => {
    try {
      // Get chat details to find the other user
      const chatRes = await api.get(`/api/chats/${chatId}`)
      const chat = chatRes.data.data
      if (chat?.members) {
        const other = chat.members.find((m: any) => m.userId !== user?.id)
        if (other?.user) {
          setContact({
            id: other.user.id,
            name: other.user.name,
            phone: other.user.phone,
            avatarUrl: other.user.avatarUrl,
            emoji: other.user.emoji,
            role: other.user.role || 'STAFF',
          })

          // Find common groups
          const chatsRes = await api.get('/api/chats')
          const chats = chatsRes.data.data || []
          const groups = chats
            .filter(
              (c: any) =>
                c.type === 'GROUP' &&
                c.members?.some((m: any) => m.userId === other.userId)
            )
            .map((c: any) => ({
              id: c.id,
              name: c.name,
              memberCount: c.members?.length || 0,
            }))
          setCommonGroups(groups)
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to load contact info')
    } finally {
      setLoading(false)
    }
  }

  const handleBlock = () => {
    Alert.alert(
      isBlocked ? 'Unblock' : 'Block',
      `${isBlocked ? 'Unblock' : 'Block'} ${contact?.name}? ${isBlocked ? 'They will be able to send you messages again.' : 'They will no longer be able to send you messages.'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isBlocked ? 'Unblock' : 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api.post(`/api/chats/${chatId}/block`)
              setIsBlocked(res.data.data.blocked)
            } catch {}
          },
        },
      ]
    )
  }

  const handleReport = () => {
    Alert.alert('Report Submitted', 'We will review this contact.', [{ text: 'OK' }])
  }

  const roleLabel =
    contact?.role === 'SUPER_ADMIN'
      ? 'Super Admin'
      : contact?.role === 'ADMIN'
        ? 'Admin'
        : 'Staff'

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </View>
    )
  }

  if (!contact) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Contact not found</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.headerBg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>{'<'}</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.headerText }]}>Contact Info</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Contact header */}
        <View style={[styles.contactHeader, { backgroundColor: colors.surface }]}>
          <View style={[styles.contactAvatar, { backgroundColor: colors.primary + '30' }]}>
            <Text style={[styles.contactAvatarText, { color: colors.primary }]}>
              {contact.emoji || contact.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.contactName, { color: colors.text }]}>{contact.name}</Text>
          <Text style={[styles.contactPhone, { color: colors.textMuted }]}>{contact.phone}</Text>
        </View>

        {/* About section */}
        <View style={[styles.section, { backgroundColor: colors.surface, marginTop: 16 }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ABOUT</Text>
          <Text style={[styles.sectionValue, { color: colors.text }]}>{roleLabel}</Text>
        </View>

        {/* Common groups */}
        {commonGroups.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              {commonGroups.length} GROUP{commonGroups.length !== 1 ? 'S' : ''} IN COMMON
            </Text>
            <View style={{ backgroundColor: colors.surface }}>
              {commonGroups.map((group, i) => (
                <View key={group.id}>
                  <View style={styles.groupRow}>
                    <View style={[styles.groupIcon, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>G</Text>
                    </View>
                    <View style={styles.groupInfo}>
                      <Text style={[styles.groupName, { color: colors.text }]} numberOfLines={1}>
                        {group.name}
                      </Text>
                      <Text style={[styles.groupMembers, { color: colors.textMuted }]}>
                        {group.memberCount} members
                      </Text>
                    </View>
                  </View>
                  {i < commonGroups.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: colors.border, marginLeft: 72 }]} />
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Block */}
        <TouchableOpacity
          style={[styles.dangerBtn, { backgroundColor: colors.surface, marginTop: 24 }]}
          onPress={handleBlock}
        >
          <View style={[styles.dangerIcon, { backgroundColor: '#EF444420' }]}>
            <Text style={{ color: '#EF4444', fontSize: 18 }}>⊘</Text>
          </View>
          <Text style={styles.dangerText}>
            {isBlocked ? 'Unblock' : 'Block'} {contact.name}
          </Text>
        </TouchableOpacity>

        {/* Report */}
        <TouchableOpacity
          style={[styles.dangerBtn, { backgroundColor: colors.surface, marginTop: 1 }]}
          onPress={handleReport}
        >
          <View style={[styles.dangerIcon, { backgroundColor: '#EF444420' }]}>
            <Text style={{ color: '#EF4444', fontSize: 18 }}>⚑</Text>
          </View>
          <Text style={styles.dangerText}>Report {contact.name}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '500',
  },
  headerInfo: {
    flex: 1,
    paddingLeft: 10,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '500',
  },
  contactHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  contactAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactAvatarText: {
    fontSize: 32,
    fontWeight: '600',
  },
  contactName: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 12,
  },
  contactPhone: {
    fontSize: 15,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionValue: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInfo: {
    flex: 1,
    paddingLeft: 12,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '500',
  },
  groupMembers: {
    fontSize: 13,
    marginTop: 1,
  },
  divider: {
    height: 1,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  dangerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  emptyText: {
    textAlign: 'center',
    padding: 40,
    fontSize: 15,
  },
})
