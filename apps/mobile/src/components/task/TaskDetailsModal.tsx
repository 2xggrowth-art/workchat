import { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { api } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'

interface TaskDetailsModalProps {
  visible: boolean
  onClose: () => void
  taskId: string
  chatId: string
  memberRole?: string
  onTaskUpdated?: () => void
}

interface Task {
  id: string
  title: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REOPENED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate?: string
  ownerId: string
  owner: { id: string; name: string }
  createdBy: { id: string; name: string }
  steps?: Array<{
    id: string
    content: string
    isMandatory: boolean
    completedAt?: string
  }>
  activities?: Array<{
    id: string
    action: string
    user: { name: string }
    details?: any
    createdAt: string
  }>
  messageContent?: string
  isOverdue?: boolean
  tags?: string[]
  sopInstructions?: string
  isRecurring?: boolean
  recurringRule?: string
  proofs?: Array<{
    id: string
    type: string
    url: string
    createdAt: string
  }>
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#2196F3',
  IN_PROGRESS: '#FFC107',
  COMPLETED: '#4CAF50',
  APPROVED: '#4CAF50',
  REOPENED: '#9C27B0',
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  LOW: { bg: 'rgba(33,150,243,0.1)', text: '#2196F3' },
  MEDIUM: { bg: 'rgba(255,193,7,0.1)', text: '#F57F17' },
  HIGH: { bg: 'rgba(255,152,0,0.1)', text: '#FF9800' },
  URGENT: { bg: 'rgba(244,67,54,0.1)', text: '#F44336' },
}

const AVATAR_COLORS = ['#E91E63', '#9C27B0', '#3F51B5', '#009688', '#FF5722', '#795548']

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function TaskDetailsModal({
  visible,
  onClose,
  taskId,
  chatId,
  memberRole,
  onTaskUpdated,
}: TaskDetailsModalProps) {
  const user = useAuthStore((state) => state.user)
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details')

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const isGroupAdmin = memberRole === 'OWNER' || memberRole === 'ADMIN' || isAdmin
  const isTaskOwner = task?.ownerId === user?.id

  useEffect(() => {
    if (visible && taskId) {
      fetchTask()
      setActiveTab('details')
    }
  }, [visible, taskId])

  const fetchTask = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/api/tasks/${taskId}`)
      setTask(response.data.data)
    } catch (error) {
      console.error('Failed to fetch task:', error)
      Alert.alert('Error', 'Failed to load task details')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (newStatus: string) => {
    setUpdating(true)
    try {
      await api.patch(`/api/tasks/${taskId}/status`, { status: newStatus })
      await fetchTask()
      onTaskUpdated?.()
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to update task status')
    } finally {
      setUpdating(false)
    }
  }

  const completeStep = async (stepId: string) => {
    try {
      await api.post(`/api/tasks/${taskId}/steps/${stepId}/complete`)
      await fetchTask()
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to complete step')
    }
  }

  const approveTask = async () => {
    setUpdating(true)
    try {
      await api.post(`/api/tasks/${taskId}/approve`)
      await fetchTask()
      onTaskUpdated?.()
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to approve task')
    } finally {
      setUpdating(false)
    }
  }

  const reopenTask = async () => {
    setUpdating(true)
    try {
      await api.post(`/api/tasks/${taskId}/reopen`)
      await fetchTask()
      onTaskUpdated?.()
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to reopen task')
    } finally {
      setUpdating(false)
    }
  }

  const uploadProof = async () => {
    Alert.alert('Upload Proof', 'Choose source', [
      {
        text: 'Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
          if (status !== 'granted') return
          const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 })
          if (!result.canceled && result.assets[0]) {
            await submitProof(result.assets[0].uri, 'IMAGE')
          }
        },
      },
      {
        text: 'File',
        onPress: async () => {
          const result = await DocumentPicker.getDocumentAsync({ type: '*/*' })
          if (!result.canceled && result.assets[0]) {
            await submitProof(result.assets[0].uri, 'FILE')
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const submitProof = async (uri: string, type: string) => {
    try {
      const formData = new FormData()
      const filename = uri.split('/').pop() || 'proof'
      formData.append('file', { uri, name: filename, type: 'application/octet-stream' } as any)
      formData.append('type', type)
      await api.post(`/api/tasks/${taskId}/proof`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await fetchTask()
      onTaskUpdated?.()
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to upload proof')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }) + ', ' + date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  const getStatusColor = () => {
    if (!task) return '#2196F3'
    if (task.isOverdue) return '#F44336'
    return STATUS_COLORS[task.status] || '#2196F3'
  }

  const getStatusLabel = () => {
    if (!task) return 'PENDING'
    if (task.isOverdue) return 'OVERDUE'
    return task.status.replace('_', ' ')
  }

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'CREATED': return '+'
      case 'STATUS_CHANGED': return '>'
      case 'STEP_COMPLETED': return 'V'
      case 'APPROVED': return 'V'
      case 'REOPENED': return 'R'
      default: return '*'
    }
  }

  const getActivityColor = (action: string) => {
    switch (action) {
      case 'CREATED': return '#2196F3'
      case 'STATUS_CHANGED': return '#FFC107'
      case 'STEP_COMPLETED': return '#4CAF50'
      case 'APPROVED': return '#4CAF50'
      case 'REOPENED': return '#9C27B0'
      default: return '#9E9E9E'
    }
  }

  const getActivityText = (activity: any) => {
    switch (activity.action) {
      case 'CREATED':
        return 'created this task'
      case 'STATUS_CHANGED':
        return `changed status to ${activity.details?.to?.replace('_', ' ')}`
      case 'STEP_COMPLETED':
        return `completed "${activity.details?.stepContent}"`
      case 'PROOF_UPLOADED':
        return 'uploaded proof'
      case 'APPROVED':
        return 'approved this task'
      case 'REOPENED':
        return 'reopened this task'
      default:
        return activity.action
    }
  }

  const canStartWorking = isTaskOwner && task?.status === 'PENDING'
  const canMarkComplete = isTaskOwner && task?.status === 'IN_PROGRESS'
  const canResumeWorking = isTaskOwner && task?.status === 'REOPENED'
  const canApprove = isGroupAdmin && task?.status === 'COMPLETED'

  const statusColor = getStatusColor()

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* App Bar style header */}
          <View style={styles.appBar}>
            <TouchableOpacity onPress={onClose} style={styles.appBarBack}>
              <Text style={styles.appBarBackText}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={styles.appBarTitle}>Task Details</Text>
            <View style={{ width: 40 }} />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#128C7E" />
            </View>
          ) : task ? (
            <>
              {/* Colored status header */}
              <View style={[styles.taskHeader, { backgroundColor: statusColor }]}>
                <Text style={styles.taskHeaderIcon}>T</Text>
                <Text style={styles.taskHeaderTitle} numberOfLines={2}>{task.title}</Text>
                <Text style={styles.taskHeaderStatus}>{getStatusLabel()}</Text>
              </View>

              {/* Tabs */}
              <View style={styles.tabs}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'details' && styles.tabActive]}
                  onPress={() => setActiveTab('details')}
                >
                  <Text style={[styles.tabText, activeTab === 'details' && styles.tabTextActive]}>
                    Details
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'activity' && styles.tabActive]}
                  onPress={() => setActiveTab('activity')}
                >
                  <Text style={[styles.tabText, activeTab === 'activity' && styles.tabTextActive]}>
                    Activity ({task.activities?.length || 0})
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.detailBody}>
                {activeTab === 'details' ? (
                  <>
                    {/* Info Card */}
                    <View style={styles.detailCard}>
                      <Text style={styles.detailCardTitle}>INFORMATION</Text>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Assigned to</Text>
                        <View style={styles.detailValueRow}>
                          <View style={[styles.detailAvatar, { backgroundColor: getAvatarColor(task.owner?.name || '') }]}>
                            <Text style={styles.detailAvatarText}>
                              {task.owner?.name?.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.detailValue}>{task.owner?.name}</Text>
                        </View>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Priority</Text>
                        <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[task.priority]?.bg }]}>
                          <Text style={[styles.priorityBadgeText, { color: PRIORITY_COLORS[task.priority]?.text }]}>
                            {task.priority}
                          </Text>
                        </View>
                      </View>

                      {task.dueDate && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Due date</Text>
                          <Text style={[styles.detailValue, task.isOverdue && { color: '#F44336' }]}>
                            {formatDate(task.dueDate)}
                          </Text>
                        </View>
                      )}

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Created by</Text>
                        <Text style={styles.detailValue}>{task.createdBy?.name}</Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Status</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                          <Text style={styles.statusBadgeText}>{getStatusLabel()}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Description card */}
                    {task.messageContent && (
                      <View style={styles.detailCard}>
                        <Text style={styles.detailCardTitle}>DESCRIPTION</Text>
                        <Text style={styles.descriptionText}>{task.messageContent}</Text>
                      </View>
                    )}

                    {/* Tags */}
                    {task.tags && task.tags.length > 0 && (
                      <View style={styles.detailCard}>
                        <Text style={styles.detailCardTitle}>TAGS</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {task.tags.map((tag, i) => (
                            <View key={i} style={{ backgroundColor: 'rgba(18,140,126,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                              <Text style={{ fontSize: 13, color: '#128C7E' }}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* SOP */}
                    {task.sopInstructions && (
                      <View style={styles.detailCard}>
                        <Text style={styles.detailCardTitle}>SOP INSTRUCTIONS</Text>
                        <Text style={styles.descriptionText}>{task.sopInstructions}</Text>
                      </View>
                    )}

                    {/* Recurring */}
                    {task.isRecurring && (
                      <View style={styles.detailCard}>
                        <Text style={styles.detailCardTitle}>RECURRING</Text>
                        <Text style={styles.descriptionText}>{task.recurringRule || 'Recurring'}</Text>
                      </View>
                    )}

                    {/* Checklist card */}
                    {task.steps && task.steps.length > 0 && (
                      <View style={styles.detailCard}>
                        <Text style={styles.detailCardTitle}>
                          CHECKLIST ({task.steps.filter((s) => s.completedAt).length}/{task.steps.length})
                        </Text>
                        {task.steps.map((step) => (
                          <TouchableOpacity
                            key={step.id}
                            style={styles.checklistItem}
                            onPress={() => {
                              if (!step.completedAt && isTaskOwner) {
                                completeStep(step.id)
                              }
                            }}
                            disabled={!!step.completedAt || !isTaskOwner}
                          >
                            <View
                              style={[
                                styles.checkbox,
                                !!step.completedAt && styles.checkboxChecked,
                              ]}
                            >
                              {!!step.completedAt && <Text style={styles.checkmark}>V</Text>}
                            </View>
                            <Text
                              style={[
                                styles.checklistText,
                                !!step.completedAt && styles.checklistTextDone,
                              ]}
                            >
                              {step.content}
                              {step.isMandatory && <Text style={styles.mandatory}> *</Text>}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                ) : (
                  /* Activity Tab */
                  <View style={styles.detailCard}>
                    <Text style={styles.detailCardTitle}>TIMELINE</Text>
                    {task.activities && task.activities.length > 0 ? (
                      task.activities.map((activity) => (
                        <View key={activity.id} style={styles.timelineItem}>
                          <View style={[styles.timelineDot, { backgroundColor: getActivityColor(activity.action) }]} />
                          <View style={styles.timelineContent}>
                            <Text style={styles.timelineText}>
                              <Text style={styles.timelineUser}>{activity.user?.name}</Text>
                              {' '}{getActivityText(activity)}
                            </Text>
                            <Text style={styles.timelineTime}>{formatDate(activity.createdAt)}</Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No activity yet</Text>
                    )}
                  </View>
                )}
              </ScrollView>

              {/* Footer actions */}
              <View style={styles.footer}>
                {canStartWorking && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#FFC107' }]}
                    onPress={() => updateStatus('IN_PROGRESS')}
                    disabled={updating}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.actionBtnText}>Start Working</Text>
                    )}
                  </TouchableOpacity>
                )}

                {canMarkComplete && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#4CAF50' }]}
                    onPress={() => updateStatus('COMPLETED')}
                    disabled={updating}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.actionBtnText}>Mark as Completed</Text>
                    )}
                  </TouchableOpacity>
                )}

                {canResumeWorking && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#FFC107' }]}
                    onPress={() => updateStatus('IN_PROGRESS')}
                    disabled={updating}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.actionBtnText}>Resume Working</Text>
                    )}
                  </TouchableOpacity>
                )}

                {canApprove && (
                  <View style={styles.adminActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#9C27B0', flex: 1, marginRight: 8 }]}
                      onPress={reopenTask}
                      disabled={updating}
                    >
                      {updating ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.actionBtnText}>Reopen</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#4CAF50', flex: 1 }]}
                      onPress={approveTask}
                      disabled={updating}
                    >
                      {updating ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.actionBtnText}>Approve</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {isTaskOwner && task.status !== 'APPROVED' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#FF9800', marginBottom: 8 }]}
                    onPress={uploadProof}
                  >
                    <Text style={styles.actionBtnText}>Upload Proof</Text>
                  </TouchableOpacity>
                )}

                {task.status === 'APPROVED' && (
                  <View style={styles.approvedBanner}>
                    <Text style={styles.approvedBannerText}>Task Approved</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={styles.loadingContainer}>
              <Text style={styles.errorText}>Task not found</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    minHeight: '60%',
    overflow: 'hidden',
  },
  // App bar
  appBar: {
    backgroundColor: '#128C7E',
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  appBarBack: {
    padding: 8,
    width: 40,
  },
  appBarBackText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '500',
  },
  appBarTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Task header (colored)
  taskHeader: {
    padding: 20,
    alignItems: 'center',
  },
  taskHeaderIcon: {
    fontSize: 36,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 8,
  },
  taskHeaderTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  taskHeaderStatus: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#128C7E',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9E9E9E',
  },
  tabTextActive: {
    color: '#128C7E',
  },
  // Detail body
  detailBody: {
    flex: 1,
    padding: 16,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  detailCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9E9E9E',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: '#9E9E9E',
    minWidth: 80,
  },
  detailValue: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '500',
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  detailAvatarText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  descriptionText: {
    fontSize: 14,
    color: '#616161',
    lineHeight: 20,
  },
  // Checklist
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#128C7E',
    borderColor: '#128C7E',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  checklistText: {
    flex: 1,
    fontSize: 14,
    color: '#424242',
  },
  checklistTextDone: {
    color: '#BDBDBD',
    textDecorationLine: 'line-through',
  },
  mandatory: {
    color: '#F44336',
  },
  // Timeline
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  timelineContent: {
    flex: 1,
  },
  timelineText: {
    fontSize: 13,
    color: '#424242',
  },
  timelineUser: {
    fontWeight: '600',
  },
  timelineTime: {
    fontSize: 11,
    color: '#9E9E9E',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9E9E9E',
    paddingVertical: 20,
  },
  errorText: {
    color: '#757575',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  // Footer
  footer: {
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  adminActions: {
    flexDirection: 'row',
  },
  approvedBanner: {
    backgroundColor: 'rgba(76,175,80,0.1)',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  approvedBannerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
})
