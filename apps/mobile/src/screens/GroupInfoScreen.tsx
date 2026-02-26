import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../stores/authStore'
import { useTheme } from '../contexts/ThemeContext'
import { api } from '../services/api'

interface Member {
  userId: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  user: {
    id: string
    name: string
    phone: string
    avatarUrl?: string
    emoji?: string
  }
}

interface OrgUser {
  id: string
  name: string
  phone: string
  status: string
}

export default function GroupInfoScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const { chatId } = route.params as { chatId: string }
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const user = useAuthStore((s) => s.user)

  const [members, setMembers] = useState<Member[]>([])
  const [groupName, setGroupName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  // Add members state
  const [showAddMembers, setShowAddMembers] = useState(false)
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [addingMembers, setAddingMembers] = useState(false)

  const myMembership = members.find((m) => m.userId === user?.id)
  const isOwner = myMembership?.role === 'OWNER'
  const isAdmin = myMembership?.role === 'ADMIN' || isOwner

  useEffect(() => {
    fetchChat()
  }, [chatId])

  const fetchChat = async () => {
    try {
      const res = await api.get(`/api/chats/${chatId}`)
      const chat = res.data.data
      setGroupName(chat.name || '')
      setNameInput(chat.name || '')
      setMembers(chat.members || [])
    } catch {
      Alert.alert('Error', 'Failed to load group info')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateName = async () => {
    if (!nameInput.trim() || nameInput.trim() === groupName) {
      setEditingName(false)
      return
    }
    try {
      await api.patch(`/api/chats/${chatId}`, { name: nameInput.trim() })
      setGroupName(nameInput.trim())
      setEditingName(false)
    } catch {
      Alert.alert('Error', 'Failed to update group name')
    }
  }

  const fetchOrgUsers = async () => {
    try {
      const res = await api.get('/api/org/members')
      const memberIds = new Set(members.map((m) => m.userId))
      setOrgUsers(
        (res.data.data || []).filter(
          (u: OrgUser) => !memberIds.has(u.id) && u.status === 'ACTIVE'
        )
      )
    } catch {}
  }

  const handleAddMembers = async () => {
    if (selectedUserIds.length === 0) return
    setAddingMembers(true)
    try {
      await api.post(`/api/chats/${chatId}/members`, { userIds: selectedUserIds })
      setSelectedUserIds([])
      setShowAddMembers(false)
      fetchChat()
    } catch {
      Alert.alert('Error', 'Failed to add members')
    } finally {
      setAddingMembers(false)
    }
  }

  const handleRemoveMember = (memberId: string, memberName: string) => {
    Alert.alert('Remove Member', `Remove ${memberName} from this group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/chats/${chatId}/members/${memberId}`)
            setMembers((prev) => prev.filter((m) => m.userId !== memberId))
            setSelectedMemberId(null)
          } catch {}
        },
      },
    ])
  }

  const handlePromote = async (memberId: string) => {
    try {
      await api.post(`/api/chats/${chatId}/members/${memberId}/promote`)
      setMembers((prev) =>
        prev.map((m) => (m.userId === memberId ? { ...m, role: 'ADMIN' as const } : m))
      )
      setSelectedMemberId(null)
    } catch {}
  }

  const handleDemote = async (memberId: string) => {
    try {
      await api.post(`/api/chats/${chatId}/members/${memberId}/demote`)
      setMembers((prev) =>
        prev.map((m) => (m.userId === memberId ? { ...m, role: 'MEMBER' as const } : m))
      )
      setSelectedMemberId(null)
    } catch {}
  }

  const handleLeaveGroup = () => {
    Alert.alert('Exit Group', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Exit',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post(`/api/chats/${chatId}/leave`)
            navigation.goBack()
            navigation.goBack()
          } catch {}
        },
      },
    ])
  }

  const roleLabel = (role: string) => {
    if (role === 'OWNER') return 'Owner'
    if (role === 'ADMIN') return 'Admin'
    return 'Member'
  }

  const roleIcon = (role: string) => {
    if (role === 'OWNER') return '★'
    if (role === 'ADMIN') return '⚑'
    return ''
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </View>
    )
  }

  // Add Members Sub-screen
  if (showAddMembers) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.headerBg }]}>
          <TouchableOpacity onPress={() => { setShowAddMembers(false); setSelectedUserIds([]) }} style={styles.backButton}>
            <Text style={styles.backIcon}>{'<'}</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerName, { color: colors.headerText }]}>Add Members</Text>
          </View>
          {selectedUserIds.length > 0 && (
            <TouchableOpacity onPress={handleAddMembers} disabled={addingMembers} style={{ padding: 8 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                Add ({selectedUserIds.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView style={{ flex: 1 }}>
          {orgUsers.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              All org members are already in this group
            </Text>
          ) : (
            orgUsers.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={[styles.memberRow, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setSelectedUserIds((prev) =>
                    prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                  )
                }}
              >
                <View style={[styles.avatar, { backgroundColor: colors.primary + '40' }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {u.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: colors.text }]}>{u.name}</Text>
                  <Text style={[styles.memberPhone, { color: colors.textMuted }]}>{u.phone}</Text>
                </View>
                {selectedUserIds.includes(u.id) && (
                  <View style={[styles.checkMark, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
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
          <Text style={[styles.headerName, { color: colors.headerText }]}>Group Info</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Group header */}
        <View style={[styles.groupHeader, { backgroundColor: colors.surface }]}>
          <View style={[styles.groupAvatar, { backgroundColor: colors.primary + '30' }]}>
            <Text style={[styles.groupAvatarText, { color: colors.primary }]}>G</Text>
          </View>
          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                style={[styles.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
              />
              <TouchableOpacity onPress={handleUpdateName} style={styles.nameEditBtn}>
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>✓</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setNameInput(groupName); setEditingName(false) }} style={styles.nameEditBtn}>
                <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: '600' }}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => isAdmin && setEditingName(true)}>
              <Text style={[styles.groupNameText, { color: colors.text }]}>{groupName}</Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.memberCountText, { color: colors.textMuted }]}>
            {members.length} members
          </Text>
        </View>

        {/* Add Members Button */}
        {isAdmin && (
          <TouchableOpacity
            style={[styles.addMembersBtn, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
            onPress={() => { fetchOrgUsers(); setShowAddMembers(true) }}
          >
            <View style={[styles.addMembersIcon, { backgroundColor: colors.primary + '20' }]}>
              <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '600' }}>+</Text>
            </View>
            <Text style={[styles.addMembersText, { color: colors.primary }]}>Add Members</Text>
          </TouchableOpacity>
        )}

        {/* Members List */}
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            MEMBERS ({members.length})
          </Text>
          <View style={{ backgroundColor: colors.surface }}>
            {members.map((member, i) => (
              <View key={member.userId}>
                <TouchableOpacity
                  style={styles.memberRow}
                  onPress={() => {
                    if (isAdmin && member.userId !== user?.id && !(member.role === 'OWNER' && !isOwner)) {
                      setSelectedMemberId(selectedMemberId === member.userId ? null : member.userId)
                    }
                  }}
                >
                  <View style={[styles.avatar, { backgroundColor: colors.primary + '30' }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                      {member.user?.name?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.memberName, { color: colors.text }]}>
                        {member.user?.name}{member.userId === user?.id ? ' (You)' : ''}
                      </Text>
                      {roleIcon(member.role) ? (
                        <Text style={{ fontSize: 12, color: member.role === 'OWNER' ? '#F59E0B' : '#3B82F6' }}>
                          {roleIcon(member.role)}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.memberPhone, { color: colors.textMuted }]}>
                      {member.user?.phone}
                    </Text>
                  </View>
                  <Text style={[styles.roleLabel, { color: colors.textMuted }]}>
                    {roleLabel(member.role)}
                  </Text>
                  {isAdmin && member.userId !== user?.id && !(member.role === 'OWNER' && !isOwner) && (
                    <Text style={{ color: colors.textMuted, fontSize: 18, paddingLeft: 8 }}>⋮</Text>
                  )}
                </TouchableOpacity>

                {/* Action buttons for selected member */}
                {selectedMemberId === member.userId && (
                  <View style={[styles.actionRow, { backgroundColor: colors.surfaceSecondary }]}>
                    {isOwner && member.role === 'MEMBER' && (
                      <TouchableOpacity
                        onPress={() => handlePromote(member.userId)}
                        style={[styles.actionBtn, { backgroundColor: '#3B82F620' }]}
                      >
                        <Text style={[styles.actionBtnText, { color: '#3B82F6' }]}>Make Admin</Text>
                      </TouchableOpacity>
                    )}
                    {isOwner && member.role === 'ADMIN' && (
                      <TouchableOpacity
                        onPress={() => handleDemote(member.userId)}
                        style={[styles.actionBtn, { backgroundColor: '#F59E0B20' }]}
                      >
                        <Text style={[styles.actionBtnText, { color: '#F59E0B' }]}>Dismiss Admin</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => handleRemoveMember(member.userId, member.user?.name || 'this member')}
                      style={[styles.actionBtn, { backgroundColor: '#EF444420' }]}
                    >
                      <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {i < members.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: colors.border, marginLeft: 72 }]} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Exit Group */}
        <TouchableOpacity
          style={[styles.exitGroupBtn, { backgroundColor: colors.surface }]}
          onPress={handleLeaveGroup}
        >
          <View style={[styles.exitGroupIcon, { backgroundColor: '#EF444420' }]}>
            <Text style={{ color: '#EF4444', fontSize: 18 }}>→</Text>
          </View>
          <Text style={styles.exitGroupText}>Exit Group</Text>
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
  groupHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  groupAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupAvatarText: {
    fontSize: 32,
    fontWeight: '600',
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 32,
    gap: 8,
  },
  nameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  nameEditBtn: {
    padding: 6,
  },
  groupNameText: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 12,
  },
  memberCountText: {
    fontSize: 14,
    marginTop: 4,
  },
  addMembersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginTop: 16,
    gap: 12,
  },
  addMembersIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMembersText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
    paddingLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
  },
  memberPhone: {
    fontSize: 13,
    marginTop: 1,
  },
  roleLabel: {
    fontSize: 12,
  },
  checkMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
  },
  exitGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginTop: 24,
    gap: 12,
  },
  exitGroupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exitGroupText: {
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
