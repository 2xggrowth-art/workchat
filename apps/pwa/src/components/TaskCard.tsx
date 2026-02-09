import { Task, TaskStatus } from '../types'
import { User, Clock } from 'lucide-react'
import { format, isPast, parseISO } from 'date-fns'

const STATUS_BAR_COLORS: Record<string, string> = {
  [TaskStatus.PENDING]: 'bg-task-pending',
  [TaskStatus.IN_PROGRESS]: 'bg-task-progress',
  [TaskStatus.COMPLETED]: 'bg-task-completed',
  [TaskStatus.APPROVED]: 'bg-task-completed',
  [TaskStatus.REOPENED]: 'bg-task-reopened',
}

const STATUS_TEXT_COLORS: Record<string, string> = {
  [TaskStatus.PENDING]: 'text-task-pending',
  [TaskStatus.IN_PROGRESS]: 'text-task-progress',
  [TaskStatus.COMPLETED]: 'text-task-completed',
  [TaskStatus.APPROVED]: 'text-task-completed',
  [TaskStatus.REOPENED]: 'text-task-reopened',
}

const STATUS_LABELS: Record<string, string> = {
  [TaskStatus.PENDING]: 'PENDING',
  [TaskStatus.IN_PROGRESS]: 'IN PROGRESS',
  [TaskStatus.COMPLETED]: 'COMPLETED',
  [TaskStatus.APPROVED]: 'APPROVED',
  [TaskStatus.REOPENED]: 'REOPENED',
}

interface TaskCardProps {
  task: Task
  onClick: () => void
}

export default function TaskCard({ task, onClick }: TaskCardProps) {
  const isOverdue = task.dueDate && isPast(parseISO(task.dueDate)) && task.status !== TaskStatus.APPROVED && task.status !== TaskStatus.COMPLETED
  const displayStatus = isOverdue ? 'OVERDUE' : task.status
  const barColor = isOverdue ? 'bg-task-overdue' : (STATUS_BAR_COLORS[task.status] || 'bg-task-pending')
  const textColor = isOverdue ? 'text-task-overdue' : (STATUS_TEXT_COLORS[task.status] || 'text-task-pending')

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden shadow-sm cursor-pointer active:opacity-80 max-w-[85%]"
    >
      <div className="relative pl-4 pr-3 py-2.5">
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${barColor}`} />
        <div className={`text-[11px] font-bold uppercase tracking-wide mb-1 ${textColor}`}>
          {isOverdue ? 'OVERDUE' : STATUS_LABELS[task.status]}
        </div>
        <div className="text-[16px] font-semibold mb-1.5 dark:text-white">{task.title}</div>
        <div className="flex gap-3 text-[13px] text-gray-400">
          <div className="flex items-center gap-1">
            <User size={14} />
            {task.owner?.name || 'Unassigned'}
          </div>
          {task.dueDate && (
            <div className={`flex items-center gap-1 ${isOverdue ? 'text-task-overdue' : ''}`}>
              <Clock size={14} />
              {format(parseISO(task.dueDate), 'MMM d, h:mm a')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
