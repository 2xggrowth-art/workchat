import { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native'
import { api } from '../../services/api'

// Try to import DateTimePicker, but make it optional
let DateTimePicker: any = null
try {
  DateTimePicker = require('@react-native-community/datetimepicker').default
} catch (e) {
  // DateTimePicker not available
}

interface Member {
  userId: string
  user: {
    id: string
    name: string
    phone: string
  }
  role: string
}

interface ConvertToTaskModalProps {
  visible: boolean
  onClose: () => void
  message: {
    id: string
    content: string
    chatId: string
  } | null
  members: Member[]
  onSuccess: () => void
}

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
type Priority = (typeof PRIORITIES)[number]

export default function ConvertToTaskModal({
  visible,
  onClose,
  message,
  members,
  onSuccess,
}: ConvertToTaskModalProps) {
  const [title, setTitle] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [priority, setPriority] = useState<Priority>('MEDIUM')
  const [approvalRequired, setApprovalRequired] = useState(true)
  const [steps, setSteps] = useState<{ content: string; isMandatory: boolean }[]>([])
  const [newStep, setNewStep] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showOwnerPicker, setShowOwnerPicker] = useState(false)
  // Recurring
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringRule, setRecurringRule] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY')
  // Tags & SOP
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [sopInstructions, setSopInstructions] = useState('')

  // Reset form when modal opens with new message
  const resetForm = () => {
    setTitle(message?.content?.slice(0, 200) || '')
    setOwnerId('')
    setDueDate(null)
    setPriority('MEDIUM')
    setApprovalRequired(true)
    setSteps([])
    setNewStep('')
    setError('')
    setIsRecurring(false)
    setRecurringRule('DAILY')
    setTags([])
    setNewTag('')
    setSopInstructions('')
  }

  // Reset on open
  useEffect(() => {
    if (visible && message) {
      resetForm()
    }
  }, [visible, message?.id])

  const selectedOwner = members.find((m) => m.userId === ownerId)

  const handleDateChange = (_: any, selectedDate?: Date) => {
    setShowDatePicker(false)
    if (selectedDate) {
      if (dueDate) {
        // Preserve time if already set
        selectedDate.setHours(dueDate.getHours(), dueDate.getMinutes())
      }
      setDueDate(selectedDate)
    }
  }

  const handleTimeChange = (_: any, selectedTime?: Date) => {
    setShowTimePicker(false)
    if (selectedTime && dueDate) {
      const newDate = new Date(dueDate)
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes())
      setDueDate(newDate)
    }
  }

  const addStep = () => {
    if (newStep.trim()) {
      setSteps([...steps, { content: newStep.trim(), isMandatory: true }])
      setNewStep('')
    }
  }

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!message || !ownerId) {
      setError('Please select an assignee')
      return
    }

    setLoading(true)
    setError('')

    try {
      await api.post(`/api/messages/${message.id}/convert-to-task`, {
        title: title || message.content?.slice(0, 200),
        ownerId,
        dueDate: dueDate?.toISOString(),
        priority,
        approvalRequired,
        steps: steps.length > 0 ? steps : undefined,
        isRecurring,
        recurringRule: isRecurring ? recurringRule : undefined,
        tags: tags.length > 0 ? tags : undefined,
        sopInstructions: sopInstructions.trim() || undefined,
      })

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to convert to task')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  if (!message) return null

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Convert to Task</Text>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!ownerId || loading}
              style={[styles.saveButton, (!ownerId || loading) && styles.saveButtonDisabled]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Original message preview */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Original Message</Text>
              <View style={styles.messagePreview}>
                <Text style={styles.messageText} numberOfLines={3}>
                  {message.content}
                </Text>
              </View>
            </View>

            {/* Title */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Task Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter task title"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Owner/Assignee */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Assign to *</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowOwnerPicker(!showOwnerPicker)}
              >
                <Text style={selectedOwner ? styles.pickerTextSelected : styles.pickerText}>
                  {selectedOwner ? selectedOwner.user.name : 'Select a member'}
                </Text>
                <Text style={styles.pickerArrow}>{showOwnerPicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showOwnerPicker && (
                <View style={styles.pickerOptions}>
                  {members.map((member) => (
                    <TouchableOpacity
                      key={member.userId}
                      style={[
                        styles.pickerOption,
                        ownerId === member.userId && styles.pickerOptionSelected,
                      ]}
                      onPress={() => {
                        setOwnerId(member.userId)
                        setShowOwnerPicker(false)
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          ownerId === member.userId && styles.pickerOptionTextSelected,
                        ]}
                      >
                        {member.user.name}
                      </Text>
                      <Text style={styles.pickerOptionPhone}>{member.user.phone}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Due Date & Time */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Due Date & Time</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity
                  style={[styles.dateButton, { flex: 1 }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={dueDate ? styles.dateTextSelected : styles.dateText}>
                    {dueDate ? formatDate(dueDate) : 'Select date'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dateButton, { flex: 1, marginLeft: 8 }]}
                  onPress={() => {
                    if (!dueDate) setDueDate(new Date())
                    setShowTimePicker(true)
                  }}
                >
                  <Text style={dueDate ? styles.dateTextSelected : styles.dateText}>
                    {dueDate ? formatTime(dueDate) : 'Select time'}
                  </Text>
                </TouchableOpacity>
              </View>
              {dueDate && (
                <TouchableOpacity onPress={() => setDueDate(null)} style={styles.clearDateButton}>
                  <Text style={styles.clearDateText}>Clear date</Text>
                </TouchableOpacity>
              )}
            </View>

            {showDatePicker && DateTimePicker && (
              <DateTimePicker
                value={dueDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            )}

            {showTimePicker && DateTimePicker && (
              <DateTimePicker
                value={dueDate || new Date()}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleTimeChange}
              />
            )}

            {/* Fallback if DateTimePicker is not available */}
            {!DateTimePicker && (showDatePicker || showTimePicker) && (
              <View style={styles.datePickerFallback}>
                <Text style={styles.datePickerFallbackText}>
                  Date picker not available. Due date will be optional.
                </Text>
                <TouchableOpacity
                  style={styles.datePickerFallbackButton}
                  onPress={() => {
                    setShowDatePicker(false)
                    setShowTimePicker(false)
                  }}
                >
                  <Text style={styles.datePickerFallbackButtonText}>OK</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Priority */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Priority</Text>
              <View style={styles.priorityRow}>
                {PRIORITIES.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.priorityButton, priority === p && styles.priorityButtonSelected]}
                    onPress={() => setPriority(p)}
                  >
                    <Text
                      style={[
                        styles.priorityText,
                        priority === p && styles.priorityTextSelected,
                      ]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Approval Required */}
            <View style={styles.section}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Requires Approval</Text>
                <Switch
                  value={approvalRequired}
                  onValueChange={setApprovalRequired}
                  trackColor={{ false: '#3B4A54', true: '#128C7E' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Checklist Steps */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Checklist (optional)</Text>
              {steps.map((step, index) => (
                <View key={index} style={styles.stepItem}>
                  <Text style={styles.stepText}>{step.content}</Text>
                  <TouchableOpacity onPress={() => removeStep(index)}>
                    <Text style={styles.removeStepText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.addStepRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={newStep}
                  onChangeText={setNewStep}
                  placeholder="Add a step..."
                  placeholderTextColor="#9CA3AF"
                  onSubmitEditing={addStep}
                />
                <TouchableOpacity style={styles.addStepButton} onPress={addStep}>
                  <Text style={styles.addStepText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Recurring */}
            <View style={styles.section}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Recurring Task</Text>
                <Switch
                  value={isRecurring}
                  onValueChange={setIsRecurring}
                  trackColor={{ false: '#3B4A54', true: '#128C7E' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {isRecurring && (
                <View style={[styles.priorityRow, { marginTop: 8 }]}>
                  {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((rule) => (
                    <TouchableOpacity
                      key={rule}
                      style={[styles.priorityButton, recurringRule === rule && styles.priorityButtonSelected]}
                      onPress={() => setRecurringRule(rule)}
                    >
                      <Text style={[styles.priorityText, recurringRule === rule && styles.priorityTextSelected]}>
                        {rule}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Tags */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Tags (optional)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: tags.length > 0 ? 8 : 0 }}>
                {tags.map((tag, i) => (
                  <TouchableOpacity key={i} onPress={() => setTags(tags.filter((_, idx) => idx !== i))} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ fontSize: 13, color: '#2E7D32' }}>{tag}</Text>
                    <Text style={{ fontSize: 12, color: '#9E9E9E', marginLeft: 6 }}>x</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.addStepRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={newTag}
                  onChangeText={setNewTag}
                  placeholder="Add a tag..."
                  placeholderTextColor="#9CA3AF"
                  onSubmitEditing={() => {
                    if (newTag.trim()) {
                      setTags([...tags, newTag.trim()])
                      setNewTag('')
                    }
                  }}
                />
                <TouchableOpacity style={styles.addStepButton} onPress={() => {
                  if (newTag.trim()) {
                    setTags([...tags, newTag.trim()])
                    setNewTag('')
                  }
                }}>
                  <Text style={styles.addStepText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* SOP Instructions */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SOP Instructions (optional)</Text>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                value={sopInstructions}
                onChangeText={setSopInstructions}
                placeholder="Enter standard operating procedure..."
                placeholderTextColor="#9CA3AF"
                multiline
              />
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 16,
    color: '#6B7280',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  saveButton: {
    backgroundColor: '#128C7E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#757575',
    marginBottom: 6,
  },
  messagePreview: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#128C7E',
  },
  messageText: {
    fontSize: 14,
    color: '#374151',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#212121',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  pickerButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  pickerTextSelected: {
    fontSize: 16,
    color: '#111827',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#6B7280',
  },
  pickerOptions: {
    marginTop: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerOptionSelected: {
    backgroundColor: '#128C7E',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#111827',
  },
  pickerOptionTextSelected: {
    color: '#FFFFFF',
  },
  pickerOptionPhone: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  dateTimeRow: {
    flexDirection: 'row',
  },
  dateButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  dateTextSelected: {
    fontSize: 16,
    color: '#111827',
    textAlign: 'center',
  },
  clearDateButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  clearDateText: {
    fontSize: 14,
    color: '#EF4444',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  priorityButtonSelected: {
    backgroundColor: '#128C7E',
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  priorityTextSelected: {
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
  },
  switchLabel: {
    fontSize: 16,
    color: '#111827',
  },
  stepItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  removeStepText: {
    fontSize: 12,
    color: '#EF4444',
    marginLeft: 8,
  },
  addStepRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addStepButton: {
    backgroundColor: '#128C7E',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addStepText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
  },
  datePickerFallback: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  datePickerFallbackText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
    marginBottom: 12,
  },
  datePickerFallbackButton: {
    backgroundColor: '#128C7E',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
  },
  datePickerFallbackButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
})
