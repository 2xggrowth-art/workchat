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
import { useFocusEffect } from '@react-navigation/native'
import { api } from '../services/api'
import TaskDetailsModal from '../components/task/TaskDetailsModal'

interface Task {
  id: string
  title: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REOPENED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate?: string
  owner: {
    id: string
    name: string
  }
  createdAt: string
  message?: {
    chatId: string
  }
  steps?: Array<{
    id: string
    completedAt?: string
  }>
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#2196F3',
  IN_PROGRESS: '#FFC107',
  COMPLETED: '#4CAF50',
  APPROVED: '#4CAF50',
  REOPENED: '#9C27B0',
}

const STATUS_BG: Record<string, string> = {
  PENDING: 'rgba(33,150,243,0.1)',
  IN_PROGRESS: 'rgba(255,193,7,0.1)',
  COMPLETED: 'rgba(76,175,80,0.1)',
  APPROVED: 'rgba(76,175,80,0.1)',
  REOPENED: 'rgba(156,39,176,0.1)',
}

type FilterType = 'all' | 'pending' | 'overdue' | 'done'

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)

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

  const onRefresh = () => {
    setRefreshing(true)
    fetchTasks()
  }

  const isOverdue = (task: Task) => {
    if (!task.dueDate) return false
    if (task.status === 'COMPLETED' || task.status === 'APPROVED') return false
    return new Date(task.dueDate) < new Date()
  }

  const filteredTasks = tasks.filter((task) => {
    switch (filter) {
      case 'pending':
        return task.status === 'PENDING' || task.status === 'IN_PROGRESS'
      case 'overdue':
        return isOverdue(task)
      case 'done':
        return task.status === 'COMPLETED' || task.status === 'APPROVED'
      default:
        return true
    }
  })

  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ', ' +
      date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const getTaskColor = (task: Task) => {
    if (isOverdue(task)) return '#F44336'
    return STATUS_COLORS[task.status] || '#2196F3'
  }

  const getStatusLabel = (task: Task) => {
    if (isOverdue(task)) return 'OVERDUE'
    return task.status.replace('_', ' ')
  }

  const getStepProgress = (task: Task) => {
    if (!task.steps || task.steps.length === 0) return null
    const done = task.steps.filter((s) => s.completedAt).length
    return `${done}/${task.steps.length}`
  }

  const openTaskDetails = (task: Task) => {
    if (!task.message?.chatId) {
      // Cannot open details without a valid chatId
      return
    }
    setSelectedTask(task)
    setShowTaskModal(true)
  }

  const renderSegment = (label: string, value: FilterType) => (
    <TouchableOpacity
      key={value}
      style={[styles.segBtn, filter === value && styles.segBtnActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[styles.segBtnText, filter === value && styles.segBtnTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  )

  const renderTask = ({ item }: { item: Task }) => {
    const color = getTaskColor(item)
    const statusBg = isOverdue(item) ? 'rgba(244,67,54,0.1)' : STATUS_BG[item.status]
    const stepProgress = getStepProgress(item)

    return (
      <TouchableOpacity
        style={styles.taskCard}
        onPress={() => openTaskDetails(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.taskStripe, { backgroundColor: color }]} />
        <View style={styles.taskInfo}>
          <Text style={styles.taskTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.taskSubRow}>
            <Text style={styles.taskSubText}>{item.owner?.name}</Text>
            {item.dueDate && (
              <Text style={styles.taskSubText}> - Due: {formatDueDate(item.dueDate)}</Text>
            )}
          </View>
          <View style={styles.taskFooter}>
            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
              <Text style={[styles.statusBadgeText, { color }]}>
                {getStatusLabel(item)}
              </Text>
            </View>
            {stepProgress && (
              <Text style={styles.taskSteps}>{stepProgress} steps</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No tasks yet</Text>
      <Text style={styles.emptySubtitle}>Tasks will appear here when created from chats</Text>
    </View>
  )

  return (
    <View style={styles.container}>
      {/* Segment Control */}
      <View style={styles.segmentContainer}>
        <View style={styles.segment}>
          {renderSegment('All', 'all')}
          {renderSegment('Pending', 'pending')}
          {renderSegment('Overdue', 'overdue')}
          {renderSegment('Done', 'done')}
        </View>
      </View>

      {/* Task List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#128C7E" />
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          renderItem={renderTask}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, filteredTasks.length === 0 && styles.listContentEmpty]}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#128C7E" />
          }
        />
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <TaskDetailsModal
          visible={showTaskModal}
          onClose={() => {
            setShowTaskModal(false)
            setSelectedTask(null)
          }}
          taskId={selectedTask.id}
          chatId={selectedTask.message?.chatId || ''}
          onTaskUpdated={fetchTasks}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  segmentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 4,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#EEEEEE',
    borderRadius: 10,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  segBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#757575',
  },
  segBtnTextActive: {
    color: '#212121',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 12,
    paddingTop: 8,
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
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    flexDirection: 'row',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },
  taskStripe: {
    width: 4,
  },
  taskInfo: {
    flex: 1,
    padding: 14,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  taskSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  taskSubText: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  taskSteps: {
    fontSize: 12,
    color: '#9E9E9E',
  },
})
