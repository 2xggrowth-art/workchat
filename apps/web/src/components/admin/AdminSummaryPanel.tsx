import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { TaskStatus, TASK_STATUS_COLORS, isOverdue, formatMessageTime } from '@workchat/shared'

interface AdminSummaryPanelProps {
  onClose: () => void
}

export default function AdminSummaryPanel({ onClose }: AdminSummaryPanelProps) {
  const navigate = useNavigate()

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await api.get('/api/tasks')
      return response.data.data
    },
  })

  const tasks = tasksData || []

  const pending = tasks.filter((t: any) => t.status === TaskStatus.PENDING).length
  const inProgress = tasks.filter((t: any) => t.status === TaskStatus.IN_PROGRESS).length
  const overdue = tasks.filter((t: any) =>
    t.dueDate && isOverdue(t.dueDate) &&
    t.status !== TaskStatus.APPROVED && t.status !== TaskStatus.COMPLETED
  ).length
  const completed = tasks.filter((t: any) =>
    t.status === TaskStatus.COMPLETED || t.status === TaskStatus.APPROVED
  ).length

  // Group tasks by owner
  const byOwner: Record<string, { name: string; color: string; total: number; pending: number; inProgress: number; overdue: number; completed: number }> = {}
  tasks.forEach((t: any) => {
    const ownerName = t.owner?.name || 'Unassigned'
    if (!byOwner[ownerName]) {
      byOwner[ownerName] = { name: ownerName, color: '#6B7C85', total: 0, pending: 0, inProgress: 0, overdue: 0, completed: 0 }
    }
    const o = byOwner[ownerName]
    o.total++
    if (t.status === TaskStatus.PENDING) o.pending++
    else if (t.status === TaskStatus.IN_PROGRESS) o.inProgress++
    else if (t.status === TaskStatus.COMPLETED || t.status === TaskStatus.APPROVED) o.completed++
    if (t.dueDate && isOverdue(t.dueDate) && t.status !== TaskStatus.APPROVED && t.status !== TaskStatus.COMPLETED) o.overdue++
  })

  // Click-to-jump: navigate to the chat and scroll to the task message
  const handleTaskClick = (task: any) => {
    if (!task.message?.chatId) return
    onClose()
    navigate(`/chat/${task.message.chatId}`)
    // After navigation, scroll to the message after a short delay
    setTimeout(() => {
      const el = document.getElementById(`msg-${task.messageId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('bg-yellow-200/40', 'dark:bg-yellow-500/10', 'rounded-lg')
        setTimeout(() => {
          el.classList.remove('bg-yellow-200/40', 'dark:bg-yellow-500/10', 'rounded-lg')
        }, 2000)
      }
    }, 500)
  }

  // Recent active tasks (not approved, sorted by creation)
  const activeTasks = tasks
    .filter((t: any) => t.status !== TaskStatus.APPROVED)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20)

  return (
    <div className="absolute inset-0 bg-white dark:bg-[#111B21] z-[200] flex flex-col">
      {/* Header */}
      <div className="bg-[#075E54] dark:bg-[#1f2c33] px-5 py-4 flex items-center gap-3">
        <button onClick={onClose} className="text-white text-lg">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        <h3 className="text-white text-lg font-medium">Daily Summary</h3>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#E9EDEF] mb-6">Daily Task Summary</h2>

            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <SummaryCard label="Total Tasks" value={tasks.length} color="#128C7E" />
              <SummaryCard label="Pending / Active" value={pending + inProgress} color="#2196F3" />
              <SummaryCard label="Overdue" value={overdue} color="#F44336" />
              <SummaryCard label="Completed" value={completed} color="#4CAF50" />
            </div>

            {/* Per person breakdown */}
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#E9EDEF] mb-4">Per Person Breakdown</h3>
            <div className="overflow-x-auto mb-8">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200 dark:border-[#222D34]">
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 dark:text-[#8696A0] uppercase tracking-wider">Staff Member</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 dark:text-[#8696A0] uppercase tracking-wider">Total</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 dark:text-[#8696A0] uppercase tracking-wider">Pending</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 dark:text-[#8696A0] uppercase tracking-wider">In Progress</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 dark:text-[#8696A0] uppercase tracking-wider">Overdue</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 dark:text-[#8696A0] uppercase tracking-wider">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(byOwner).map((person) => (
                    <tr key={person.name} className="border-b border-gray-100 dark:border-[#222D34] hover:bg-gray-50 dark:hover:bg-[#202C33]">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#128C7E] flex items-center justify-center text-white text-xs font-semibold">
                            {person.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-[#E9EDEF]">{person.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700 dark:text-[#E9EDEF]">{person.total}</td>
                      <td className="py-3 px-4">
                        {person.pending > 0 ? <CountBadge value={person.pending} variant="blue" /> : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="py-3 px-4">
                        {person.inProgress > 0 ? <CountBadge value={person.inProgress} variant="yellow" /> : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="py-3 px-4">
                        {person.overdue > 0 ? <CountBadge value={person.overdue} variant="red" /> : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="py-3 px-4">
                        {person.completed > 0 ? <CountBadge value={person.completed} variant="green" /> : <span className="text-gray-400">-</span>}
                      </td>
                    </tr>
                  ))}
                  {Object.keys(byOwner).length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400 dark:text-[#8696A0] text-sm">No tasks found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Active Tasks List - click to jump */}
            {activeTasks.length > 0 && (
              <>
                <h3 className="text-base font-semibold text-gray-900 dark:text-[#E9EDEF] mb-4">Active Tasks</h3>
                <div className="space-y-2">
                  {activeTasks.map((task: any) => {
                    const statusColor = TASK_STATUS_COLORS[task.status as TaskStatus] || TASK_STATUS_COLORS[TaskStatus.PENDING]
                    const taskOverdue = task.dueDate && isOverdue(task.dueDate) && task.status !== TaskStatus.APPROVED && task.status !== TaskStatus.COMPLETED
                    return (
                      <div
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        className="flex items-center gap-3 p-3 bg-[#f0f2f5] dark:bg-[#202C33] rounded-lg cursor-pointer hover:bg-[#e9edef] dark:hover:bg-[#2A3942] transition-colors"
                        style={{ borderLeft: `3px solid ${taskOverdue ? '#EF4444' : statusColor}` }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-[#E9EDEF] truncate">{task.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded text-white"
                              style={{ background: taskOverdue ? '#EF4444' : statusColor }}
                            >
                              {taskOverdue ? 'OVERDUE' : task.status.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-[#8696A0]">{task.owner?.name || 'Unassigned'}</span>
                            {task.dueDate && (
                              <span className={`text-xs ${taskOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                                {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                        </svg>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[#f0f2f5] dark:bg-[#202C33] rounded-xl p-5 text-center">
      <div className="text-4xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-[#8696A0] uppercase tracking-wider mt-1">{label}</div>
    </div>
  )
}

function CountBadge({ value, variant }: { value: number; variant: 'blue' | 'red' | 'green' | 'yellow' }) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    green: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    yellow: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  }
  return (
    <span className={`inline-flex items-center justify-center min-w-[28px] h-6 rounded-xl text-xs font-semibold px-2 ${styles[variant]}`}>
      {value}
    </span>
  )
}
