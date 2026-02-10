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
import { useNavigation } from '@react-navigation/native'
import { useAuthStore } from '../stores/authStore'
import { useTheme } from '../contexts/ThemeContext'
import { api } from '../services/api'

interface OrgMember {
  id: string
  phone: string
  name: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'STAFF'
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED'
  createdAt: string
}

export default function MembersScreen() {
  const { user } = useAuthStore()
  const { colors } = useTheme()
  const navigation = useNavigation()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMembers = async () => {
    try {
      const res = await api.get('/api/org/members')
      setMembers(res.data.data)
    } catch (err) {
      console.error('Failed to fetch members:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMembers() }, [])

  const handlePromote = async (id: string) => {
    try {
      await api.post(`/api/org/promote/${id}`)
      fetchMembers()
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error?.message || 'Failed to promote')
    }
  }

  const handleDemote = async (id: string) => {
    try {
      await api.post(`/api/org/demote/${id}`)
      fetchMembers()
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error?.message || 'Failed to demote')
    }
  }

  const handleSuspend = async (id: string) => {
    Alert.alert('Suspend User', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Suspend',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post(`/api/org/suspend/${id}`)
            fetchMembers()
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error?.message || 'Failed to suspend')
          }
        },
      },
    ])
  }

  const handleActivate = async (id: string) => {
    try {
      await api.post(`/api/org/activate/${id}`)
      fetchMembers()
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error?.message || 'Failed to activate')
    }
  }

  const superAdmins = members.filter(m => m.role === 'SUPER_ADMIN')
  const admins = members.filter(m => m.role === 'ADMIN')
  const staff = members.filter(m => m.role === 'STAFF')
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  const statusColor = (status: string) => {
    if (status === 'ACTIVE') return '#4CAF50'
    if (status === 'PENDING') return '#FF9800'
    return '#F44336'
  }

  const renderSection = (title: string, list: OrgMember[]) => {
    if (list.length === 0) return null
    return (
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={styles.sectionTitle}>{title} ({list.length})</Text>
        {list.map((member) => (
          <View key={member.id} style={styles.memberRow}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>
                {member.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.memberInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.memberName, { color: colors.text }]}>{member.name}</Text>
                {member.id === user?.id && (
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>(You)</Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.memberPhone, { color: colors.textMuted }]}>{member.phone}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(member.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: statusColor(member.status) }]}>{member.status}</Text>
                </View>
              </View>
            </View>
            {canManage && member.id !== user?.id && member.role !== 'SUPER_ADMIN' && (
              <View style={styles.actions}>
                {member.role === 'STAFF' && (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#E3F2FD' }]} onPress={() => handlePromote(member.id)}>
                    <Text style={{ fontSize: 11, color: '#1976D2', fontWeight: '600' }}>Promote</Text>
                  </TouchableOpacity>
                )}
                {member.role === 'ADMIN' && (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FFF3E0' }]} onPress={() => handleDemote(member.id)}>
                    <Text style={{ fontSize: 11, color: '#E65100', fontWeight: '600' }}>Demote</Text>
                  </TouchableOpacity>
                )}
                {member.status === 'ACTIVE' ? (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FFEBEE' }]} onPress={() => handleSuspend(member.id)}>
                    <Text style={{ fontSize: 11, color: '#D32F2F', fontWeight: '600' }}>Suspend</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#E8F5E9' }]} onPress={() => handleActivate(member.id)}>
                    <Text style={{ fontSize: 11, color: '#388E3C', fontWeight: '600' }}>Activate</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ))}
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <View style={[styles.header, { backgroundColor: colors.primaryDark }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Members</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={styles.body}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#128C7E" />
          </View>
        ) : (
          <>
            {renderSection('Super Admins', superAdmins)}
            {renderSection('Admins', admins)}
            {renderSection('Staff', staff)}
          </>
        )}
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
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#075E54',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  body: {
    flex: 1,
  },
  loadingContainer: {
    paddingTop: 60,
    alignItems: 'center',
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
    textTransform: 'uppercase',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#128C7E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '500',
  },
  memberPhone: {
    fontSize: 12,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
})
