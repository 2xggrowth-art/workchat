import { TaskStatus } from '../types'

const STATUS_STYLES: Record<string, string> = {
  [TaskStatus.PENDING]: 'bg-task-pending text-white',
  [TaskStatus.IN_PROGRESS]: 'bg-task-progress text-gray-800',
  [TaskStatus.COMPLETED]: 'bg-task-completed text-white',
  [TaskStatus.APPROVED]: 'bg-task-completed text-white',
  [TaskStatus.REOPENED]: 'bg-task-reopened text-white',
  OVERDUE: 'bg-task-overdue text-white',
}

const STATUS_LABELS: Record<string, string> = {
  [TaskStatus.PENDING]: 'Pending',
  [TaskStatus.IN_PROGRESS]: 'In Progress',
  [TaskStatus.COMPLETED]: 'Completed',
  [TaskStatus.APPROVED]: 'Approved',
  [TaskStatus.REOPENED]: 'Reopened',
  OVERDUE: 'Overdue',
}

interface StatusPillProps {
  status: string
  large?: boolean
}

export default function StatusPill({ status, large }: StatusPillProps) {
  const isOverdue = status === 'OVERDUE'
  const style = STATUS_STYLES[status] || STATUS_STYLES[TaskStatus.PENDING]
  const label = STATUS_LABELS[status] || status

  return (
    <span
      className={`inline-block rounded-full font-semibold uppercase tracking-wide ${style} ${
        large ? 'text-sm px-4 py-1.5' : 'text-[11px] px-2 py-0.5'
      }`}
    >
      {label}
    </span>
  )
}
