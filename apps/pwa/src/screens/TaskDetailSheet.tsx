import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import Sheet from '../components/Sheet'
import StatusPill from '../components/StatusPill'
import { Task, TaskStatus } from '../types'
import { useAuthStore } from '../stores/authStore'
import { useTaskStore } from '../stores/taskStore'
import { api } from '../services/api'
import { format, parseISO, isPast, formatDistanceToNow } from 'date-fns'

interface TaskDetailSheetProps {
  taskId: string | null
  onClose: () => void
}

const ACTIVITY_ICONS: Record<string, string> = {
  created: '\u{1F4DD}',
  started: '\u{25B6}\u{FE0F}',
  completed: '\u{2705}',
  approved: '\u{1F44D}',
  reopened: '\u{1F504}',
  proof_uploaded: '\u{1F4F7}',
  status_changed: '\u{1F504}',
}

export default function TaskDetailSheet({ taskId, onClose }: TaskDetailSheetProps) {
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sopExpanded, setSopExpanded] = useState(false)
  const user = useAuthStore((s) => s.user)
  const { updateTaskStatus } = useTaskStore()
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  useEffect(() => {
    if (taskId) {
      setLoading(true)
      api.get(`/api/tasks/${taskId}`).then((res) => {
        setTask(res.data.data)
        setLoading(false)
      }).catch(() => setLoading(false))
    } else {
      setTask(null)
    }
  }, [taskId])

  if (!taskId) return null

  const isOverdue = task?.dueDate && isPast(parseISO(task.dueDate)) && task.status !== TaskStatus.APPROVED && task.status !== TaskStatus.COMPLETED
  const displayStatus = isOverdue ? 'OVERDUE' : (task?.status || '')

  const handleStatusChange = async (newStatus: string) => {
    if (!task) return
    try {
      await updateTaskStatus(task.id, newStatus)
      setTask((prev) => prev ? { ...prev, status: newStatus as TaskStatus } : prev)
    } catch {
      // error
    }
  }

  const handleApprove = async () => {
    if (!task) return
    try {
      await api.post(`/api/tasks/${task.id}/approve`)
      setTask((prev) => prev ? { ...prev, status: TaskStatus.APPROVED } : prev)
    } catch {
      // error
    }
  }

  const handleReopen = async () => {
    if (!task) return
    try {
      await api.post(`/api/tasks/${task.id}/reopen`)
      setTask((prev) => prev ? { ...prev, status: TaskStatus.REOPENED } : prev)
    } catch {
      // error
    }
  }

  const handleCompleteStep = async (stepId: string) => {
    if (!task) return
    try {
      await api.post(`/api/tasks/${task.id}/steps/${stepId}/complete`)
      setTask((prev) => {
        if (!prev || !prev.steps) return prev
        return {
          ...prev,
          steps: prev.steps.map((s) =>
            s.id === stepId ? { ...s, completedAt: new Date().toISOString() } : s
          ),
        }
      })
    } catch {
      // error
    }
  }

  const handleUploadProof = async (file: File) => {
    if (!task) return
    setUploading(true)
    try {
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
      await api.post(`/api/tasks/${task.id}/proof`, { type, url })
      const res = await api.get(`/api/tasks/${task.id}`)
      setTask(res.data.data)
    } catch {
      // error
    } finally {
      setUploading(false)
    }
  }

  const isTaskOwner = task?.ownerId === user?.id
  const canCompleteSteps = isTaskOwner && (task?.status === TaskStatus.IN_PROGRESS || task?.status === TaskStatus.REOPENED)

  return (
    <Sheet open={!!taskId} onClose={onClose} title="Task Details">
      {loading || !task ? (
        <div className="text-center text-gray-400 py-10">Loading...</div>
      ) : (
        <div>
          {/* Status pill centered */}
          <div className="text-center py-3 pb-5">
            <StatusPill status={displayStatus} large />
          </div>

          {/* Details group */}
          <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">Details</div>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4">
            <DetailRow label="Title" value={task.title} bold />
            <DetailRow label="Owner" value={task.owner?.name || 'Unassigned'} />
            <DetailRow
              label="Due"
              value={task.dueDate ? format(parseISO(task.dueDate), 'MMM d, yyyy h:mm a') : 'No due date'}
              valueColor={isOverdue ? 'text-red-500' : undefined}
            />
            <DetailRow label="Priority" value={task.priority} />
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <>
              <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">Tags</div>
              <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4 px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {task.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="inline-block bg-wgreen/15 text-wgreen text-[13px] font-medium px-2.5 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* SOP Instructions */}
          {task.sopInstructions && (
            <>
              <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">SOP Instructions</div>
              <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4">
                <button
                  onClick={() => setSopExpanded(!sopExpanded)}
                  className="flex items-center justify-between w-full px-4 py-3 active:bg-gray-100 dark:active:bg-white/5"
                >
                  <span className="text-[15px] dark:text-white">
                    {sopExpanded ? 'Hide Instructions' : 'View Instructions'}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`text-gray-400 transition-transform ${sopExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
                {sopExpanded && (
                  <div className="px-4 pb-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                    <p className="text-[15px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap pt-3">
                      {task.sopInstructions}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Checklist */}
          {task.steps && task.steps.length > 0 && (
            <>
              <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">Checklist</div>
              <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4">
                {task.steps.map((step) => (
                  <button
                    key={step.id}
                    className={`flex items-center gap-2.5 px-4 py-2.5 border-b border-black/[0.06] dark:border-white/[0.06] last:border-b-0 w-full text-left ${
                      !step.completedAt && canCompleteSteps ? 'active:bg-gray-100 dark:active:bg-white/5' : ''
                    }`}
                    onClick={() => {
                      if (!step.completedAt && canCompleteSteps) handleCompleteStep(step.id)
                    }}
                    disabled={!!step.completedAt || !canCompleteSteps}
                  >
                    <div
                      className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 ${
                        step.completedAt ? 'bg-wgreen border-wgreen' : 'border-gray-400'
                      }`}
                    >
                      {step.completedAt && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <polyline points="20 6 9 17 4 12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-[17px] ${step.completedAt ? 'line-through text-gray-400' : 'dark:text-white'}`}>
                      {step.content}
                      {step.isMandatory && <span className="text-red-500 ml-1">*</span>}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Proof upload */}
          {isTaskOwner && canCompleteSteps && (
            <>
              <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">Proof</div>
              <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4">
                {task.proofs && task.proofs.length > 0 && (
                  <div className="grid grid-cols-3 gap-1 p-2">
                    {task.proofs.map((p: any) => (
                      <div key={p.id} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-1 text-center h-16 flex items-center justify-center">
                        {p.type === 'IMAGE' ? (
                          <img src={p.url} alt="" className="w-full h-full object-cover rounded" />
                        ) : (
                          <span className="text-xl">{p.type === 'VIDEO' ? '\u{1F3A5}' : p.type === 'AUDIO' ? '\u{1F3B5}' : '\u{1F4C4}'}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <label className="flex items-center justify-center gap-2 px-4 py-3 active:bg-gray-100 dark:active:bg-white/5 cursor-pointer">
                  <span className="text-wgreen text-[17px] font-semibold">
                    {uploading ? 'Uploading...' : '+ Upload Proof'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleUploadProof(file)
                      e.target.value = ''
                    }}
                    disabled={uploading}
                  />
                </label>
              </div>
            </>
          )}

          {/* Activity Timeline */}
          {task.activities && task.activities.length > 0 && (
            <>
              <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">Timeline</div>
              <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4">
                {task.activities.map((activity, i) => (
                  <div
                    key={activity.id}
                    className={`flex items-start gap-3 px-4 py-2.5 ${
                      i < task.activities!.length - 1 ? 'border-b border-black/[0.06] dark:border-white/[0.06]' : ''
                    }`}
                  >
                    <span className="text-[18px] mt-0.5 shrink-0">
                      {ACTIVITY_ICONS[activity.action] || '\u{1F4CB}'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] dark:text-white">
                        <span className="font-medium">{activity.user?.name || 'System'}</span>
                        {' '}
                        <span className="text-gray-500 dark:text-gray-400">
                          {activity.action.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-[12px] text-gray-400">
                        {activity.createdAt
                          ? formatDistanceToNow(parseISO(activity.createdAt), { addSuffix: true })
                          : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="space-y-2 mt-2">
            {(task.status === TaskStatus.PENDING || task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.REOPENED) && (
              <button
                onClick={() => handleStatusChange(task.status === TaskStatus.PENDING ? 'IN_PROGRESS' : 'COMPLETED')}
                className="w-full py-3.5 rounded-xl bg-wgreen text-white text-[17px] font-semibold active:opacity-80"
              >
                {task.status === TaskStatus.PENDING ? 'Start Task' : 'Mark Complete'}
              </button>
            )}
            {task.status === TaskStatus.COMPLETED && isAdmin && (
              <>
                <button
                  onClick={handleApprove}
                  className="w-full py-3.5 rounded-xl bg-wgreen text-white text-[17px] font-semibold active:opacity-80"
                >
                  Approve
                </button>
                <button
                  onClick={handleReopen}
                  className="w-full py-3.5 rounded-xl bg-red-500 text-white text-[17px] font-semibold active:opacity-80"
                >
                  Reopen
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}

function DetailRow({ label, value, bold, valueColor }: { label: string; value: string; bold?: boolean; valueColor?: string }) {
  return (
    <div className="flex items-center px-4 py-3 min-h-[44px] border-b border-black/[0.06] dark:border-white/[0.06] last:border-b-0">
      <span className="text-[17px] min-w-[90px] dark:text-white">{label}</span>
      <span className={`flex-1 text-right text-[17px] ${valueColor || (bold ? 'font-semibold dark:text-white' : 'text-gray-400')}`}>
        {value}
      </span>
    </div>
  )
}
