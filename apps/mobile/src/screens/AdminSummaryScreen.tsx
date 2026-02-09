import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../services/api'
import { useTheme } from '../contexts/ThemeContext'

interface TaskSummary {
  id: string
  title: string
  status: string
  priority: string
  dueDate?: string
  ownerId: string
  owner: { id: string; name: string }
  message?: { chatId: string }
}

interface UserSummary {
  name: string
  userId: string
  pending: number
  overdue: number
  inProgress: number
  completed: number
  reopened: number
}

export default function AdminSummaryScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()

  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTasks = async () => {
    try {
      const response = await api.get('/api/tasks')
      setTasks(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchTasks()
    }, [])
  )

  const isOverdue = (task: TaskSummary) => {
    if (!task.dueDate) return false
    if (task.status === 'COMPLETED' || task.status === 'APPROVED') return false
    return new Date(task.dueDate) < new Date()
  }

  const userSummaries: UserSummary[] = (() => {
    const map = new Map<string, UserSummary>()
    tasks.forEach((task) => {
      const key = task.ownerId
      if (!map.has(key)) {
        map.set(key, {
          name: task.owner?.name || 'Unknown',
          userId: key,
          pending: 0,
          overdue: 0,
          inProgress: 0,
          completed: 0,
          reopened: 0,
        })
      }
      const s = map.get(key)!
      if (isOverdue(task)) s.overdue++
      if (task.status === 'PENDING') s.pending++
      if (task.status === 'IN_PROGRESS') s.inProgress++
      if (task.status === 'COMPLETED') s.completed++
      if (task.status === 'REOPENED') s.reopened++
    })
    return Array.from(map.values()).sort((a, b) => (b.overdue + b.pending) - (a.overdue + a.pending))
  })()

  const totalPending = tasks.filter((t) => t.status === 'PENDING').length
  const totalOverdue = tasks.filter((t) => isOverdue(t)).length
  const totalInProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length
  const totalCompleted = tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'APPROVED').length

  const renderUserCard = ({ item }: { item: UserSummary }) => (
    <View style={[styles.userCard, { backgroundColor: colors.surface }]}>
      <View style={styles.userCardHeader}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={[styles.userName, { color: colors.text }]}>{item.name}</Text>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#2196F3' }]}>{item.pending}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Pending</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#F44336' }]}>{item.overdue}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Overdue</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#FFC107' }]}>{item.inProgress}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Active</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{item.completed}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Done</Text>
        </View>
        {item.reopened > 0 && (
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#9C27B0' }]}>{item.reopened}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Reopened</Text>
          </View>
        )}
      </View>
    </View>
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.headerBg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Summary</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Overview Cards */}
      <View style={styles.overviewRow}>
        <View style={[styles.overviewCard, { backgroundColor: '#2196F3' }]}>
          <Text style={styles.overviewNumber}>{totalPending}</Text>
          <Text style={styles.overviewLabel}>Pending</Text>
        </View>
        <View style={[styles.overviewCard, { backgroundColor: '#F44336' }]}>
          <Text style={styles.overviewNumber}>{totalOverdue}</Text>
          <Text style={styles.overviewLabel}>Overdue</Text>
        </View>
        <View style={[styles.overviewCard, { backgroundColor: '#FFC107' }]}>
          <Text style={styles.overviewNumber}>{totalInProgress}</Text>
          <Text style={styles.overviewLabel}>Active</Text>
        </View>
        <View style={[styles.overviewCard, { backgroundColor: '#4CAF50' }]}>
          <Text style={styles.overviewNumber}>{totalCompleted}</Text>
          <Text style={styles.overviewLabel}>Done</Text>
        </View>
      </View>

      {/* Per-Person Breakdown */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#128C7E" />
        </View>
      ) : (
        <FlatList
          data={userSummaries}
          renderItem={renderUserCard}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No tasks found</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                fetchTasks()
              }}
              tintColor="#128C7E"
            />
          }
        />
      )}
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
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  overviewRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  overviewCard: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  overviewNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  overviewLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 12,
    paddingTop: 0,
  },
  userCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#128C7E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
})
