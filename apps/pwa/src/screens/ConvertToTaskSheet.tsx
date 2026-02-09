import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import Sheet from '../components/Sheet'
import { api } from '../services/api'
import { useChatStore } from '../stores/chatStore'
import { User } from '../types'

interface ConvertToTaskSheetProps {
  open: boolean
  onClose: () => void
  chatId: string
  messageId: string
  messageText: string
}

export default function ConvertToTaskSheet({ open, onClose, chatId, messageId, messageText }: ConvertToTaskSheetProps) {
  const [title, setTitle] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [approvalRequired, setApprovalRequired] = useState(true)
  const [isRecurring, setIsRecurring] = useState(false)
  const [steps, setSteps] = useState<string[]>([])
  const [newStep, setNewStep] = useState('')
  const [members, setMembers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [sopInstructions, setSopInstructions] = useState('')
  const { fetchMessages } = useChatStore()

  useEffect(() => {
    if (open) {
      setTitle(messageText)
      setTags([])
      setTagInput('')
      setSopInstructions('')
      // Set default due date to tomorrow 5pm
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(17, 0, 0, 0)
      setDueDate(tomorrow.toISOString().slice(0, 16))
      // Fetch chat members
      api.get(`/api/chats/${chatId}`).then((res) => {
        const chat = res.data.data
        if (chat.members) {
          setMembers(chat.members.map((m: any) => m.user))
          if (chat.members.length > 0) setAssigneeId(chat.members[0].userId)
        }
      }).catch(() => {})
    }
  }, [open, messageText, chatId])

  const addStep = () => {
    if (newStep.trim()) {
      setSteps([...steps, newStep.trim()])
      setNewStep('')
    }
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault()
      const newTag = tagInput.trim().replace(/,$/, '')
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag])
      }
      setTagInput('')
    }
  }

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index))
  }

  const handleCreate = async () => {
    if (!title.trim() || !assigneeId) return
    setLoading(true)
    try {
      await api.post(`/api/messages/${messageId}/convert-to-task`, {
        title: title.trim(),
        ownerId: assigneeId,
        dueDate: dueDate || undefined,
        priority,
        approvalRequired,
        isRecurring,
        tags: tags.length > 0 ? tags : undefined,
        sopInstructions: sopInstructions.trim() || undefined,
        steps: steps.map((s) => ({ content: s, isMandatory: true })),
      })
      await fetchMessages(chatId)
      onClose()
    } catch {
      // error
    } finally {
      setLoading(false)
    }
  }

  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New Task"
      headerRight={
        <button onClick={handleCreate} disabled={loading} className="text-blue-500 font-semibold text-[17px] py-2 px-1 disabled:opacity-50">
          Create
        </button>
      }
    >
      {/* Title */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4">
        <div className="flex items-center px-4 py-3 min-h-[44px]">
          <span className="text-[17px] min-w-[90px] dark:text-white">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="flex-1 text-right text-[17px] bg-transparent border-none outline-none dark:text-white placeholder-gray-300"
          />
        </div>
      </div>

      {/* Assign & Due */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4">
        <div className="flex items-center px-4 py-3 min-h-[44px]">
          <span className="text-[17px] min-w-[90px] dark:text-white">Assign To</span>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="flex-1 text-right text-[17px] text-blue-500 bg-transparent border-none outline-none appearance-none"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="h-px bg-black/[0.06] dark:bg-white/[0.06]" />
        <div className="flex items-center px-4 py-3 min-h-[44px]">
          <span className="text-[17px] min-w-[90px] dark:text-white">Due Date</span>
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="flex-1 text-right text-[17px] text-blue-500 bg-transparent border-none outline-none"
          />
        </div>
      </div>

      {/* Priority */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4 p-2">
        <div className="flex bg-gray-200 dark:bg-gray-700 rounded-[9px] p-0.5">
          {priorities.map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`flex-1 py-1.5 text-[13px] font-medium rounded-[7px] text-center ${
                priority === p ? 'bg-white dark:bg-[#1C1C1E] shadow-sm dark:text-white' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {p.charAt(0) + p.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">Tags</div>
      <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4 px-4 py-3">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 bg-wgreen/15 text-wgreen text-[13px] font-medium px-2.5 py-1 rounded-full"
              >
                {tag}
                <button onClick={() => removeTag(i)} className="text-wgreen/70 hover:text-wgreen">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleTagKeyDown}
          placeholder="Type tag and press Enter..."
          className="w-full text-[15px] bg-transparent border-none outline-none dark:text-white placeholder-gray-300"
        />
      </div>

      {/* SOP Instructions */}
      <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">SOP Instructions</div>
      <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4">
        <textarea
          value={sopInstructions}
          onChange={(e) => setSopInstructions(e.target.value)}
          placeholder="Standard Operating Procedure..."
          rows={3}
          className="w-full px-4 py-3 text-[15px] bg-transparent border-none outline-none resize-none dark:text-white placeholder-gray-300"
        />
      </div>

      {/* Checklist */}
      <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">Checklist</div>
      <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-black/[0.06] dark:border-white/[0.06]">
            <div className="w-[22px] h-[22px] rounded-full border-2 border-gray-400 shrink-0" />
            <span className="text-[17px] dark:text-white">{step}</span>
          </div>
        ))}
        <div className="flex items-center px-4 py-2.5">
          <input
            value={newStep}
            onChange={(e) => setNewStep(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addStep()}
            placeholder="Add checklist item..."
            className="flex-1 text-[17px] bg-transparent border-none outline-none dark:text-white placeholder-gray-300"
          />
          <button onClick={addStep} className="text-wgreen text-[15px] font-semibold px-2">Add</button>
        </div>
      </div>

      {/* Toggles */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4">
        <div className="flex items-center px-4 py-3 min-h-[44px]">
          <span className="text-[17px] flex-1 dark:text-white">Recurring</span>
          <ToggleButton on={isRecurring} onToggle={() => setIsRecurring(!isRecurring)} />
        </div>
        <div className="h-px bg-black/[0.06] dark:bg-white/[0.06]" />
        <div className="flex items-center px-4 py-3 min-h-[44px]">
          <span className="text-[17px] flex-1 dark:text-white">Approval Required</span>
          <ToggleButton on={approvalRequired} onToggle={() => setApprovalRequired(!approvalRequired)} />
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={loading}
        className="w-full py-3.5 rounded-xl bg-wgreen text-white text-[17px] font-semibold mt-2 active:opacity-80 disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create Task'}
      </button>
    </Sheet>
  )
}

function ToggleButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-[51px] h-[31px] rounded-full relative shrink-0 transition-colors ${on ? 'bg-wgreen' : 'bg-gray-300'}`}
    >
      <div
        className={`absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-5' : ''
        }`}
      />
    </button>
  )
}
