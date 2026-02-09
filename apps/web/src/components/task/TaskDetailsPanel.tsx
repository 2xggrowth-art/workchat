import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useAuthStore, useIsAdmin } from '../../stores/authStore'
import { TaskStatus, TASK_STATUS_COLORS, formatMessageTime, TaskStep, TaskProof, TaskActivity } from '@workchat/shared'

interface TaskDetailsPanelProps {
  taskId: string
  chatId: string
  onClose: () => void
}

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  MEDIUM: 'bg-orange-50 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  HIGH: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  URGENT: 'bg-red-700 text-white',
}

export default function TaskDetailsPanel({ taskId, chatId, onClose }: TaskDetailsPanelProps) {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const isAdmin = useIsAdmin()
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details')

  const { data: taskData, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const response = await api.get(`/api/tasks/${taskId}`)
      return response.data.data
    },
    enabled: !!taskId,
  })

  const task = taskData

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: TaskStatus) => {
      const response = await api.patch(`/api/tasks/${taskId}/status`, { status: newStatus })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
    },
  })

  const completeStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      const response = await api.post(`/api/tasks/${taskId}/steps/${stepId}/complete`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
    },
  })

  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/tasks/${taskId}/approve`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
    },
  })

  const uploadProofMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const { url } = uploadRes.data.data
      const type = file.type.startsWith('image/') ? 'IMAGE'
        : file.type.startsWith('video/') ? 'VIDEO'
        : file.type.startsWith('audio/') ? 'AUDIO'
        : 'FILE'
      await api.post(`/api/tasks/${taskId}/proof`, { type, url })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
    },
  })

  const reopenMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/tasks/${taskId}/reopen`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
    },
  })

  const isTaskOwner = task?.ownerId === user?.id
  const canStart = isTaskOwner && task?.status === TaskStatus.PENDING
  const canComplete = isTaskOwner && task?.status === TaskStatus.IN_PROGRESS
  const canResume = isTaskOwner && task?.status === TaskStatus.REOPENED
  const canApprove = isAdmin && task?.status === TaskStatus.COMPLETED
  const canReopen = isAdmin && task?.status === TaskStatus.COMPLETED

  const statusColor = task ? (TASK_STATUS_COLORS[task.status as TaskStatus] || TASK_STATUS_COLORS[TaskStatus.PENDING]) : TASK_STATUS_COLORS[TaskStatus.PENDING]
  const stepsTotal = task?.steps?.length || 0
  const stepsDone = task?.steps?.filter((s: TaskStep) => s.completedAt).length || 0
  const progressPct = stepsTotal > 0 ? Math.round((stepsDone / stepsTotal) * 100) : 0

  const avatarColors = ['#075E54', '#128C7E', '#25D366', '#6a1b9a', '#c62828', '#1565c0', '#2e7d32', '#e65100']

  const formatDueDate = (date: string) => {
    const d = new Date(date)
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const isOverdue = (date: string) => {
    return new Date(date) < new Date() && task?.status !== TaskStatus.APPROVED && task?.status !== TaskStatus.COMPLETED
  }

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[420px] bg-white dark:bg-[#111B21] shadow-[-4px_0_20px_rgba(0,0,0,0.1)] z-[100] flex flex-col animate-slide-in">
      {/* Header */}
      <div className="bg-[#075E54] dark:bg-[#1f2c33] px-5 py-4 flex items-center gap-3">
        <button onClick={onClose} className="text-white text-lg">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19.1 17.2l-5.3-5.3 5.3-5.3-1.8-1.8-5.3 5.4-5.3-5.3-1.8 1.7 5.3 5.3-5.3 5.3L6.7 19l5.3-5.3 5.3 5.3 1.8-1.8z"/>
          </svg>
        </button>
        <h3 className="text-white text-[16px] font-medium">Task Details</h3>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full" />
        </div>
      ) : !task ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-[#8696A0]">
          Task not found
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-[#3B4A54]">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'details'
                  ? 'text-[#075E54] dark:text-[#25D366] border-b-2 border-[#075E54] dark:border-[#25D366]'
                  : 'text-gray-500 dark:text-[#8696A0] hover:text-gray-700 dark:hover:text-[#E9EDEF]'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'activity'
                  ? 'text-[#075E54] dark:text-[#25D366] border-b-2 border-[#075E54] dark:border-[#25D366]'
                  : 'text-gray-500 dark:text-[#8696A0] hover:text-gray-700 dark:hover:text-[#E9EDEF]'
              }`}
            >
              Activity ({task.activities?.length || 0})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === 'details' ? (
              <>
                {/* Status */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-[#8696A0] uppercase tracking-wider mb-2.5">Status</h4>
                  <span
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                    style={{ background: statusColor }}
                  >
                    <span className="w-2 h-2 rounded-full bg-white/50" />
                    {task.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Title */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-[#8696A0] uppercase tracking-wider mb-2.5">Task</h4>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-[#E9EDEF]">{task.title}</h3>
                </div>

                {/* Meta grid */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-[#8696A0] uppercase tracking-wider mb-2.5">Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[11px] text-gray-400 dark:text-[#667781] uppercase mb-1">Assigned To</div>
                      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-[#E9EDEF]">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
                          style={{ background: task.owner?.name ? avatarColors[task.owner.name.charCodeAt(0) % avatarColors.length] : '#6B7C85' }}
                        >
                          {task.owner?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        {task.owner?.name || 'Unassigned'}
                      </div>
                    </div>

                    {task.dueDate && (
                      <div>
                        <div className="text-[11px] text-gray-400 dark:text-[#667781] uppercase mb-1">Due Date</div>
                        <div className={`text-sm font-medium ${isOverdue(task.dueDate) ? 'text-red-500' : 'text-gray-900 dark:text-[#E9EDEF]'}`}>
                          {formatDueDate(task.dueDate)}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-[11px] text-gray-400 dark:text-[#667781] uppercase mb-1">Priority</div>
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.MEDIUM}`}>
                        {task.priority}
                      </span>
                    </div>

                    {stepsTotal > 0 && (
                      <div>
                        <div className="text-[11px] text-gray-400 dark:text-[#667781] uppercase mb-1">Progress</div>
                        <div className="text-sm font-medium text-gray-900 dark:text-[#E9EDEF]">{stepsDone}/{stepsTotal} ({progressPct}%)</div>
                      </div>
                    )}

                    <div>
                      <div className="text-[11px] text-gray-400 dark:text-[#667781] uppercase mb-1">Created By</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-[#E9EDEF]">{task.createdBy?.name || '-'}</div>
                    </div>

                    {task.isRecurring && (
                      <div>
                        <div className="text-[11px] text-gray-400 dark:text-[#667781] uppercase mb-1">Recurring</div>
                        <div className="text-sm font-medium text-gray-900 dark:text-[#E9EDEF]">{task.recurringRule || 'Yes'}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {task.tags && task.tags.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-xs font-bold text-gray-500 dark:text-[#8696A0] uppercase tracking-wider mb-2.5">Tags</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {task.tags.map((tag: string, i: number) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-[#075E54]/10 dark:bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] text-xs rounded-full font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* SOP Instructions */}
                {task.sopInstructions && (
                  <div className="mb-6">
                    <h4 className="text-xs font-bold text-gray-500 dark:text-[#8696A0] uppercase tracking-wider mb-2.5">SOP / Instructions</h4>
                    <div className="bg-[#f0f2f5] dark:bg-[#202C33] rounded-lg p-3">
                      <p className="text-sm text-gray-700 dark:text-[#E9EDEF] whitespace-pre-wrap">{task.sopInstructions}</p>
                    </div>
                  </div>
                )}

                {/* Checklist */}
                {stepsTotal > 0 && (
                  <div className="mb-6">
                    <h4 className="text-xs font-bold text-gray-500 dark:text-[#8696A0] uppercase tracking-wider mb-2.5">
                      Checklist ({stepsDone}/{stepsTotal})
                    </h4>
                    {/* Progress bar */}
                    <div className="h-1.5 bg-gray-200 dark:bg-[#3B4A54] rounded-full overflow-hidden mb-3">
                      <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: statusColor }} />
                    </div>
                    <div className="space-y-1">
                      {task.steps.map((step: TaskStep) => (
                        <div
                          key={step.id}
                          className={`flex items-center gap-3 py-2 px-1 border-b border-gray-100 dark:border-[#222D34] ${
                            !step.completedAt && isTaskOwner && (task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.REOPENED)
                              ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-[#202C33] rounded'
                              : ''
                          }`}
                          onClick={() => {
                            if (!step.completedAt && isTaskOwner && (task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.REOPENED)) {
                              completeStepMutation.mutate(step.id)
                            }
                          }}
                        >
                          <div className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            step.completedAt
                              ? 'bg-[#128C7E] border-[#128C7E]'
                              : 'border-gray-300 dark:border-[#8696A0]'
                          }`}>
                            {step.completedAt && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                              </svg>
                            )}
                          </div>
                          <span className={`flex-1 text-sm ${
                            step.completedAt ? 'text-gray-400 dark:text-[#667781] line-through' : 'text-gray-900 dark:text-[#E9EDEF]'
                          }`}>
                            {step.content}
                            {step.isMandatory && <span className="text-red-500 ml-1">*</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Proofs */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-[#8696A0] uppercase tracking-wider mb-2.5">
                    Proofs ({task.proofs?.length || 0})
                  </h4>
                  {task.proofs && task.proofs.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {task.proofs.map((proof: TaskProof) => (
                        <div key={proof.id} className="bg-[#f0f2f5] dark:bg-[#202C33] rounded-lg p-1.5 text-center">
                          {proof.type === 'IMAGE' ? (
                            <img src={proof.url} alt="Proof" className="w-full h-20 object-cover rounded cursor-pointer" onClick={() => window.open(proof.url, '_blank')} />
                          ) : (
                            <div className="w-full h-20 flex items-center justify-center text-gray-400 dark:text-[#8696A0]">
                              <span className="text-2xl">
                                {proof.type === 'VIDEO' ? '\u{1F3A5}' : proof.type === 'AUDIO' ? '\u{1F3B5}' : '\u{1F4C4}'}
                              </span>
                            </div>
                          )}
                          <p className="text-[10px] text-gray-400 dark:text-[#667781] mt-1 truncate">{proof.user?.name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {isTaskOwner && (task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.REOPENED) && (
                    <label className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 dark:border-[#3B4A54] rounded-lg cursor-pointer hover:border-[#128C7E] dark:hover:border-[#25D366] transition-colors">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                      </svg>
                      <span className="text-sm text-gray-500 dark:text-[#8696A0]">
                        {uploadProofMutation.isPending ? 'Uploading...' : 'Upload Proof'}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) uploadProofMutation.mutate(file)
                          e.target.value = ''
                        }}
                        disabled={uploadProofMutation.isPending}
                      />
                    </label>
                  )}
                </div>
              </>
            ) : (
              /* Activity tab */
              <div className="space-y-0">
                {task.activities && task.activities.length > 0 ? (
                  task.activities.map((activity: TaskActivity) => (
                    <div key={activity.id} className="flex gap-3 py-2.5 border-b border-gray-100 dark:border-[#222D34]">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ background: activity.action === 'APPROVED' ? '#4CAF50' : activity.action === 'REOPENED' ? '#9C27B0' : '#128C7E' }}
                      />
                      <div className="flex-1">
                        <p className="text-[13px] text-gray-900 dark:text-[#E9EDEF]">
                          <span className="font-medium">{activity.user?.name}</span>
                          {' '}
                          {activity.action === 'CREATED' && 'created this task'}
                          {activity.action === 'STATUS_CHANGED' && `changed status to ${(activity.details?.to as string)?.replace('_', ' ')}`}
                          {activity.action === 'STEP_COMPLETED' && `completed "${activity.details?.stepContent as string}"`}
                          {activity.action === 'PROOF_UPLOADED' && 'uploaded proof'}
                          {activity.action === 'APPROVED' && 'approved this task'}
                          {activity.action === 'REOPENED' && 'reopened this task'}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-[#667781] mt-0.5">
                          {formatMessageTime(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-400 dark:text-[#8696A0] py-8 text-sm">No activity yet</p>
                )}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-5 py-4 border-t border-gray-200 dark:border-[#3B4A54] flex gap-3">
            {canStart && (
              <button
                onClick={() => updateStatusMutation.mutate(TaskStatus.IN_PROGRESS)}
                disabled={updateStatusMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-[#FFC107] text-gray-900 rounded-lg text-sm font-semibold hover:bg-[#FFB300] transition-colors disabled:opacity-50"
              >
                {updateStatusMutation.isPending ? 'Starting...' : 'Start Task'}
              </button>
            )}

            {canComplete && (
              <button
                onClick={() => updateStatusMutation.mutate(TaskStatus.COMPLETED)}
                disabled={updateStatusMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-[#4CAF50] text-white rounded-lg text-sm font-semibold hover:bg-[#388e3c] transition-colors disabled:opacity-50"
              >
                {updateStatusMutation.isPending ? 'Completing...' : 'Mark Complete'}
              </button>
            )}

            {canResume && (
              <button
                onClick={() => updateStatusMutation.mutate(TaskStatus.IN_PROGRESS)}
                disabled={updateStatusMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-[#FFC107] text-gray-900 rounded-lg text-sm font-semibold hover:bg-[#FFB300] transition-colors disabled:opacity-50"
              >
                {updateStatusMutation.isPending ? 'Resuming...' : 'Resume Task'}
              </button>
            )}

            {canReopen && (
              <button
                onClick={() => reopenMutation.mutate()}
                disabled={reopenMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-[#9C27B0] text-white rounded-lg text-sm font-semibold hover:bg-[#7B1FA2] transition-colors disabled:opacity-50"
              >
                {reopenMutation.isPending ? 'Reopening...' : 'Reopen'}
              </button>
            )}

            {canApprove && (
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-[#4CAF50] text-white rounded-lg text-sm font-semibold hover:bg-[#388e3c] transition-colors disabled:opacity-50"
              >
                {approveMutation.isPending ? 'Approving...' : 'Approve'}
              </button>
            )}

            {task.status === TaskStatus.APPROVED && (
              <div className="flex-1 text-center py-2.5 text-[#2E7D32] text-sm font-semibold">
                Task Approved
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
