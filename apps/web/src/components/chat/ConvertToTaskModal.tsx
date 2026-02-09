import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { TaskPriority } from '@workchat/shared'

interface Member {
  userId: string
  user: {
    id: string
    name: string
    phone: string
    avatarUrl: string | null
  }
  role: string
}

interface ConvertToTaskModalProps {
  isOpen: boolean
  onClose: () => void
  message: {
    id: string
    content: string
    chatId: string
  }
  members: Member[]
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M19.1 17.2l-5.3-5.3 5.3-5.3-1.8-1.8-5.3 5.4-5.3-5.3-1.8 1.7 5.3 5.3-5.3 5.3L6.7 19l5.3-5.3 5.3 5.3 1.8-1.8z"/>
  </svg>
)

export default function ConvertToTaskModal({
  isOpen,
  onClose,
  message,
  members,
}: ConvertToTaskModalProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(message.content?.slice(0, 200) || '')
  const [ownerId, setOwnerId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM)
  const [approvalRequired, setApprovalRequired] = useState(true)
  const [steps, setSteps] = useState<{ content: string; isMandatory: boolean }[]>([])
  const [newStep, setNewStep] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringRule, setRecurringRule] = useState('DAILY')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [sopInstructions, setSopInstructions] = useState('')

  const convertMutation = useMutation({
    mutationFn: async () => {
      const dueDateISO = dueDate && dueTime
        ? new Date(`${dueDate}T${dueTime}`).toISOString()
        : dueDate
        ? new Date(`${dueDate}T23:59:59`).toISOString()
        : undefined

      const response = await api.post(`/api/messages/${message.id}/convert-to-task`, {
        title,
        ownerId,
        dueDate: dueDateISO,
        priority,
        approvalRequired,
        steps: steps.length > 0 ? steps : undefined,
        isRecurring,
        recurringRule: isRecurring ? recurringRule : undefined,
        tags: tags.length > 0 ? tags : undefined,
        sopInstructions: sopInstructions.trim() || undefined,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', message.chatId] })
      queryClient.invalidateQueries({ queryKey: ['chats'] })
      onClose()
    },
  })

  const addStep = () => {
    if (newStep.trim()) {
      setSteps([...steps, { content: newStep.trim(), isMandatory: true }])
      setNewStep('')
    }
  }

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ownerId) return
    convertMutation.mutate()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#111B21] rounded-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#075E54] dark:bg-[#202C33] px-4 py-4 flex items-center gap-4">
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <CloseIcon />
          </button>
          <h2 className="text-white text-lg font-medium">Convert to Task</h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Original message preview */}
          <div className="bg-[#f0f2f5] dark:bg-[#202C33] rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-[#8696A0] mb-1">Original message:</p>
            <p className="text-sm text-gray-900 dark:text-[#E9EDEF]">{message.content}</p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#8696A0] mb-1.5 uppercase tracking-wider">Task Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              className="w-full bg-white dark:bg-[#2A3942] border border-gray-200 dark:border-transparent text-gray-900 dark:text-[#E9EDEF] placeholder-gray-400 dark:placeholder-[#8696A0] rounded-lg px-3 py-2.5 outline-none text-sm focus:border-[#128C7E] dark:focus:ring-1 dark:focus:ring-[#00A884] transition-colors"
              required
            />
          </div>

          {/* Owner */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#8696A0] mb-1.5 uppercase tracking-wider">Assign to *</label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="w-full bg-white dark:bg-[#2A3942] border border-gray-200 dark:border-transparent text-gray-900 dark:text-[#E9EDEF] rounded-lg px-3 py-2.5 outline-none text-sm focus:border-[#128C7E] dark:focus:ring-1 dark:focus:ring-[#00A884] cursor-pointer transition-colors"
              required
            >
              <option value="">Select a member</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.name} ({member.user.phone})
                </option>
              ))}
            </select>
          </div>

          {/* Due date and time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#8696A0] mb-1.5 uppercase tracking-wider">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-white dark:bg-[#2A3942] border border-gray-200 dark:border-transparent text-gray-900 dark:text-[#E9EDEF] rounded-lg px-3 py-2.5 outline-none text-sm focus:border-[#128C7E] dark:focus:ring-1 dark:focus:ring-[#00A884] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#8696A0] mb-1.5 uppercase tracking-wider">Due Time</label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full bg-white dark:bg-[#2A3942] border border-gray-200 dark:border-transparent text-gray-900 dark:text-[#E9EDEF] rounded-lg px-3 py-2.5 outline-none text-sm focus:border-[#128C7E] dark:focus:ring-1 dark:focus:ring-[#00A884] transition-colors"
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#8696A0] mb-1.5 uppercase tracking-wider">Priority</label>
            <div className="flex gap-2">
              {Object.values(TaskPriority).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    priority === p
                      ? 'bg-[#128C7E] dark:bg-[#00A884] text-white'
                      : 'bg-[#f0f2f5] dark:bg-[#2A3942] text-gray-600 dark:text-[#8696A0] hover:bg-[#e9edef] dark:hover:bg-[#3B4A54]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Approval required */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-[#8696A0]">Requires Approval</span>
            <button
              type="button"
              onClick={() => setApprovalRequired(!approvalRequired)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                approvalRequired ? 'bg-[#25D366]' : 'bg-gray-300 dark:bg-[#3B4A54]'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${
                  approvalRequired ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {/* Recurring */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-[#8696A0]">Recurring Task</span>
            <button
              type="button"
              onClick={() => setIsRecurring(!isRecurring)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                isRecurring ? 'bg-[#25D366]' : 'bg-gray-300 dark:bg-[#3B4A54]'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${
                  isRecurring ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>
          {isRecurring && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#8696A0] mb-1.5 uppercase tracking-wider">Recurring Rule</label>
              <select
                value={recurringRule}
                onChange={(e) => setRecurringRule(e.target.value)}
                className="w-full bg-white dark:bg-[#2A3942] border border-gray-200 dark:border-transparent text-gray-900 dark:text-[#E9EDEF] rounded-lg px-3 py-2.5 outline-none text-sm focus:border-[#128C7E] dark:focus:ring-1 dark:focus:ring-[#00A884] cursor-pointer transition-colors"
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#8696A0] mb-1.5 uppercase tracking-wider">Tags (optional)</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#075E54]/10 dark:bg-[#25D366]/10 text-[#075E54] dark:text-[#25D366] text-xs rounded-full font-medium"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((_, i) => i !== index))}
                    className="text-[#075E54]/60 dark:text-[#25D366]/60 hover:text-red-500 ml-0.5"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Type and press Enter or comma to add"
              className="w-full bg-white dark:bg-[#2A3942] border border-gray-200 dark:border-transparent text-gray-900 dark:text-[#E9EDEF] placeholder-gray-400 dark:placeholder-[#8696A0] rounded-lg px-3 py-2 outline-none text-sm focus:border-[#128C7E] transition-colors"
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                  e.preventDefault()
                  const newTag = tagInput.trim().replace(/,/g, '')
                  if (newTag && !tags.includes(newTag)) {
                    setTags([...tags, newTag])
                  }
                  setTagInput('')
                }
              }}
            />
          </div>

          {/* SOP Instructions */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#8696A0] mb-1.5 uppercase tracking-wider">SOP / Instructions (optional)</label>
            <textarea
              value={sopInstructions}
              onChange={(e) => setSopInstructions(e.target.value)}
              placeholder="Add step-by-step instructions or SOP details..."
              rows={3}
              className="w-full bg-white dark:bg-[#2A3942] border border-gray-200 dark:border-transparent text-gray-900 dark:text-[#E9EDEF] placeholder-gray-400 dark:placeholder-[#8696A0] rounded-lg px-3 py-2 outline-none text-sm focus:border-[#128C7E] dark:focus:ring-1 dark:focus:ring-[#00A884] transition-colors resize-none"
            />
          </div>

          {/* Steps/Checklist */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#8696A0] mb-1.5 uppercase tracking-wider">Checklist (optional)</label>
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div key={index} className="flex items-center gap-2 bg-[#f0f2f5] dark:bg-[#2A3942] rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-900 dark:text-[#E9EDEF] flex-1">{step.content}</span>
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newStep}
                  onChange={(e) => setNewStep(e.target.value)}
                  placeholder="Add a step..."
                  className="flex-1 bg-white dark:bg-[#2A3942] border border-gray-200 dark:border-transparent text-gray-900 dark:text-[#E9EDEF] placeholder-gray-400 dark:placeholder-[#8696A0] rounded-lg px-3 py-2 outline-none text-sm focus:border-[#128C7E] transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addStep()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addStep}
                  className="px-3 py-2 bg-[#f0f2f5] dark:bg-[#2A3942] text-[#128C7E] dark:text-[#00A884] rounded-lg text-sm hover:bg-[#e9edef] dark:hover:bg-[#3B4A54] transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 bg-[#f0f2f5] dark:bg-[#202C33] border-t border-gray-200 dark:border-[#3B4A54]">
          {convertMutation.isError && (
            <p className="text-red-500 text-sm mb-3">
              {(convertMutation.error as any)?.response?.data?.error?.message || 'Failed to convert to task'}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white dark:bg-[#2A3942] text-gray-700 dark:text-[#E9EDEF] rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-[#3B4A54] transition-colors border border-gray-200 dark:border-transparent"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!ownerId || convertMutation.isPending}
              className="flex-1 px-4 py-2.5 bg-[#25D366] text-white rounded-lg text-sm font-semibold hover:bg-[#1da851] transition-colors disabled:opacity-50"
            >
              {convertMutation.isPending ? 'Converting...' : 'Create Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
