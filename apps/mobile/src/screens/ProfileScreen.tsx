import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Pressable,
  Share,
  Clipboard,
  Platform,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { useAuthStore } from '../stores/authStore'
import { useTheme } from '../contexts/ThemeContext'
import { api } from '../services/api'

interface PendingUser {
  id: string
  phone: string
  name: string
  createdAt: string
}

const EMOJI_OPTIONS = [
  '\u{1F600}', '\u{1F468}\u200D\u{1F4BC}', '\u{1F469}\u200D\u{1F4BC}', '\u{1F477}\u200D\u2642\uFE0F', '\u{1F477}\u200D\u2640\uFE0F',
  '\u{1F9D1}\u200D\u{1F527}', '\u{1F468}\u200D\u{1F373}', '\u{1F469}\u200D\u{1F3EB}', '\u{1F9D1}\u200D\u{1F4BB}', '\u{1F3A8}',
  '\u{1F527}', '\u26A1', '\u{1F31F}', '\u{1F4AA}', '\u{1F3AF}',
  '\u{1F525}', '\u{1F4BC}', '\u{1F3D7}\uFE0F', '\u{1F4CA}', '\u{1F3AC}',
]

export default function ProfileScreen() {
  const { user, logout, setUser } = useAuthStore()
  const { mode, setMode, colors, isDark } = useTheme()
  const navigation = useNavigation<any>()
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [loadingPending, setLoadingPending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>((user as any)?.emoji || null)
  const [orgCode, setOrgCode] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [orgName, setOrgName] = useState('')
  const [regenerating, setRegenerating] = useState(false)

  const fetchPendingUsers = async () => {
    if (!isAdmin) return
    try {
      const response = await api.get('/api/auth/pending-users')
      setPendingUsers(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch pending users:', error)
    } finally {
      setLoadingPending(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      setLoadingPending(true)
      fetchPendingUsers()
    }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      api.get('/api/org/settings').then((res) => {
        setOrgCode(res.data.data.orgCode)
        setInviteLink(res.data.data.inviteLink)
        setOrgName(res.data.data.name)
      }).catch(() => {})
    }
  }, [isAdmin])

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) fetchPendingUsers()
    }, [])
  )

  const handleApprove = async (userId: string) => {
    try {
      await api.post(`/api/auth/approve-user/${userId}`)
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId))
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to approve user')
    }
  }

  const handleReject = async (userId: string) => {
    Alert.alert('Reject User', 'Are you sure you want to reject this user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post(`/api/auth/reject-user/${userId}`)
            setPendingUsers((prev) => prev.filter((u) => u.id !== userId))
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.error?.message || 'Failed to reject user')
          }
        },
      },
    ])
  }

  const handleEmojiSelect = async (emoji: string) => {
    setSelectedEmoji(emoji)
    setShowEmojiPicker(false)
    try {
      await api.patch(`/api/users/${user?.id}`, { emoji })
      if (user) {
        setUser({ ...user, emoji } as any)
      }
    } catch (error) {
      console.error('Failed to save emoji:', error)
    }
  }

  const handleShareInvite = async () => {
    try {
      await Share.share({
        message: `Join ${orgName} on WorkChat: ${inviteLink}`,
      })
    } catch {}
  }

  const handleCopyCode = () => {
    Clipboard.setString(orgCode)
    Alert.alert('Copied', 'Organization code copied to clipboard')
  }

  const handleRegenerate = () => {
    Alert.alert('Regenerate Code', 'The old code will stop working. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Regenerate',
        onPress: async () => {
          setRegenerating(true)
          try {
            const res = await api.post('/api/org/regenerate-code')
            setOrgCode(res.data.data.orgCode)
            setInviteLink(res.data.data.inviteLink)
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error?.message || 'Failed to regenerate')
          } finally {
            setRegenerating(false)
          }
        },
      },
    ])
  }

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ])
  }

  const formatPhone = (phone: string) => {
    return phone
  }

  const cycleTheme = () => {
    if (mode === 'light') setMode('dark')
    else if (mode === 'dark') setMode('system')
    else setMode('light')
  }

  const themeLabel = mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System'

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}
      refreshControl={
        isAdmin ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              fetchPendingUsers()
            }}
            tintColor="#128C7E"
          />
        ) : undefined
      }
    >
      {/* Profile Header */}
      <View style={[styles.profileHeader, { backgroundColor: colors.primaryDark }]}>
        <TouchableOpacity style={styles.profileAvatar} onPress={() => setShowEmojiPicker(true)}>
          {selectedEmoji ? (
            <Text style={styles.profileEmojiText}>{selectedEmoji}</Text>
          ) : (
            <Text style={styles.profileAvatarText}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          )}
        </TouchableOpacity>
        <Text style={styles.profileName}>{user?.name || 'User'}</Text>
        <Text style={styles.profilePhone}>{formatPhone(user?.phone || '')}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{user?.role || 'STAFF'}</Text>
        </View>
        <Text style={styles.tapHint}>Tap avatar to change emoji</Text>
      </View>

      {/* Profile Body */}
      <View style={styles.profileBody}>
        {/* Pending User Approvals (Admin only) */}
        {isAdmin && pendingUsers.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={styles.sectionTitle}>Pending Approvals</Text>
            {pendingUsers.map((pu) => (
              <View key={pu.id} style={styles.pendingItem}>
                <View style={styles.pendingAvatar}>
                  <Text style={styles.pendingAvatarText}>
                    {pu.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.pendingInfo}>
                  <Text style={[styles.pendingName, { color: colors.text }]}>{pu.name}</Text>
                  <Text style={[styles.pendingPhone, { color: colors.textMuted }]}>{pu.phone}</Text>
                </View>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => handleReject(pu.id)}
                >
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={() => handleApprove(pu.id)}
                >
                  <Text style={styles.approveBtnText}>Approve</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Organization Section (Admin only) */}
        {isAdmin && orgCode ? (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={styles.sectionTitle}>Organization</Text>
            <TouchableOpacity style={styles.menuItem} onPress={handleCopyCode}>
              <Text style={[styles.menuIcon, { color: colors.textMuted }]}>O</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuText, { color: colors.textSecondary }]}>{orgName}</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{orgCode}</Text>
              </View>
              <Text style={[styles.menuValue, { color: colors.primary }]}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleShareInvite}>
              <Text style={[styles.menuIcon, { color: '#4CAF50' }]}>S</Text>
              <Text style={[styles.menuText, { flex: 1, color: colors.textSecondary }]}>Share Invite Link</Text>
              <Text style={[styles.menuArrow, { color: colors.textMuted }]}>{'>'}</Text>
            </TouchableOpacity>
            {isSuperAdmin && (
              <TouchableOpacity style={styles.menuItem} onPress={handleRegenerate} disabled={regenerating}>
                <Text style={[styles.menuIcon, { color: '#FF9800' }]}>R</Text>
                <Text style={[styles.menuText, { flex: 1, color: colors.textSecondary }]}>
                  {regenerating ? 'Regenerating...' : 'Regenerate Code'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Members')}>
              <Text style={[styles.menuIcon, { color: '#9C27B0' }]}>M</Text>
              <Text style={[styles.menuText, { flex: 1, color: colors.textSecondary }]}>Manage Members</Text>
              <Text style={[styles.menuArrow, { color: colors.textMuted }]}>{'>'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Account Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.menuItem}>
            <Text style={[styles.menuIcon, { color: colors.textMuted }]}>U</Text>
            <Text style={[styles.menuText, { color: colors.textSecondary }]}>Edit Profile</Text>
            <Text style={[styles.menuArrow, { color: colors.textMuted }]}>{'>'}</Text>
          </View>
          <View style={styles.menuItem}>
            <Text style={[styles.menuIcon, { color: colors.textMuted }]}>L</Text>
            <Text style={[styles.menuText, { color: colors.textSecondary }]}>Privacy</Text>
            <Text style={[styles.menuArrow, { color: colors.textMuted }]}>{'>'}</Text>
          </View>
        </View>

        {/* App Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={styles.sectionTitle}>App</Text>
          <View style={styles.menuItem}>
            <Text style={[styles.menuIcon, { color: colors.textMuted }]}>N</Text>
            <Text style={[styles.menuText, { color: colors.textSecondary }]}>Notifications</Text>
            <Text style={[styles.menuArrow, { color: colors.textMuted }]}>{'>'}</Text>
          </View>
          <View style={styles.menuItem}>
            <Text style={[styles.menuIcon, { color: colors.textMuted }]}>S</Text>
            <Text style={[styles.menuText, { color: colors.textSecondary }]}>Storage and Data</Text>
            <Text style={[styles.menuArrow, { color: colors.textMuted }]}>{'>'}</Text>
          </View>
          <TouchableOpacity style={styles.menuItem} onPress={cycleTheme}>
            <Text style={[styles.menuIcon, { color: colors.textMuted }]}>T</Text>
            <Text style={[styles.menuText, { color: colors.textSecondary }]}>Theme</Text>
            <Text style={[styles.menuValue, { color: colors.primary }]}>{themeLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* Help Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={styles.sectionTitle}>Help</Text>
          <View style={styles.menuItem}>
            <Text style={[styles.menuIcon, { color: colors.textMuted }]}>?</Text>
            <Text style={[styles.menuText, { color: colors.textSecondary }]}>Help Center</Text>
            <Text style={[styles.menuArrow, { color: colors.textMuted }]}>{'>'}</Text>
          </View>
          <View style={styles.menuItem}>
            <Text style={[styles.menuIcon, { color: colors.textMuted }]}>i</Text>
            <Text style={[styles.menuText, { color: colors.textSecondary }]}>About</Text>
            <Text style={[styles.menuValue, { color: colors.textMuted }]}>v1.0.0</Text>
          </View>
        </View>

        {/* Logout */}
        <View style={[styles.section, { marginBottom: 24, backgroundColor: colors.surface }]}>
          <TouchableOpacity style={styles.logoutItem} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Emoji Picker Modal */}
      <Modal visible={showEmojiPicker} transparent animationType="fade" onRequestClose={() => setShowEmojiPicker(false)}>
        <Pressable style={styles.emojiOverlay} onPress={() => setShowEmojiPicker(false)}>
          <View style={styles.emojiContainer}>
            <Text style={styles.emojiTitle}>Choose your avatar emoji</Text>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS.map((emoji, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.emojiItem, selectedEmoji === emoji && styles.emojiItemSelected]}
                  onPress={() => handleEmojiSelect(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.emojiClearBtn}
              onPress={() => {
                setSelectedEmoji(null)
                setShowEmojiPicker(false)
                api.patch(`/api/users/${user?.id}`, { emoji: null }).catch(() => {})
              }}
            >
              <Text style={styles.emojiClearText}>Remove emoji</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  profileHeader: {
    backgroundColor: '#075E54',
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileAvatarText: {
    fontSize: 36,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  profileEmojiText: {
    fontSize: 40,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  profilePhone: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  roleBadge: {
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 8,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tapHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 6,
  },
  profileBody: {
    flex: 1,
  },
  section: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
    fontSize: 13,
    fontWeight: '500',
    color: '#128C7E',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuIcon: {
    width: 24,
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    marginRight: 16,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    color: '#424242',
  },
  menuArrow: {
    fontSize: 18,
    color: '#BDBDBD',
  },
  menuValue: {
    fontSize: 14,
    color: '#9E9E9E',
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  logoutText: {
    fontSize: 15,
    color: '#F44336',
    fontWeight: '500',
  },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  pendingAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#128C7E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pendingAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pendingInfo: {
    flex: 1,
  },
  pendingName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#212121',
  },
  pendingPhone: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 1,
  },
  rejectBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F44336',
    marginRight: 8,
  },
  rejectBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F44336',
  },
  approveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#25D366',
  },
  approveBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Emoji picker
  emojiOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emojiContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  emojiTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 16,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
  emojiItem: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  emojiItemSelected: {
    backgroundColor: 'rgba(18,140,126,0.15)',
  },
  emojiText: {
    fontSize: 28,
  },
  emojiClearBtn: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  emojiClearText: {
    fontSize: 14,
    color: '#F44336',
  },
})
