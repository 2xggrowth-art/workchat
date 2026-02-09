import { useState, useEffect } from 'react'
import IOSNav from '../components/IOSNav'
import StatusPill from '../components/StatusPill'
import Avatar from '../components/Avatar'
import { useTaskStore } from '../stores/taskStore'
import { Task, TaskStatus } from '../types'
import { isPast, parseISO } from 'date-fns'

interface TasksScreenProps {
  onTaskDetail: (taskId: string) => void
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Done' },
]

const STATUS_BAR: Record<string, string> = {
  [TaskStatus.PENDING]: 'bg-task-pending',
  [TaskStatus.IN_PROGRESS]: 'bg-task-progress',
  [TaskStatus.COMPLETED]: 'bg-task-completed',
  [TaskStatus.APPROVED]: 'bg-task-completed',
  [TaskStatus.REOPENED]: 'bg-task-reopened',
  OVERDUE: 'bg-task-overdue',
}

function isOverdue(task: Task): boolean {
  return !!(task.dueDate && isPast(parseISO(task.dueDate)) && task.status !== TaskStatus.APPROVED && task.status !== TaskStatus.COMPLETED)
}

export default function TasksScreen({ onTaskDetail }: TasksScreenProps) {
  const [filter, setFilter] = useState('all')
  const { tasks, fetchTasks } = useTaskStore()

  useEffect(() => {
    fetchTasks()
  }, [])

  let filtered = tasks
  if (filter === 'pending') filtered = tasks.filter((t) => t.status === TaskStatus.PENDING || t.status === TaskStatus.IN_PROGRESS)
  else if (filter === 'overdue') filtered = tasks.filter((t) => isOverdue(t))
  else if (filter === 'completed') filtered = tasks.filter((t) => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.APPROVED)

  return (
    <div className="flex flex-col h-full">
      <IOSNav title="Tasks">
        <div className="px-4 pb-2.5">
          <div className="flex bg-gray-200 dark:bg-gray-700 rounded-[9px] p-0.5 overflow-hidden">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex-1 py-1.5 px-3 text-[13px] font-medium rounded-[7px] text-center whitespace-nowrap ${
                  filter === f.id
                    ? 'bg-white dark:bg-[#1C1C1E] shadow-sm dark:text-white'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </IOSNav>
      <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch px-4 py-2">
        {filtered.length === 0 && (
          <div className="text-center text-gray-400 text-[15px] py-10">No tasks found</div>
        )}
        {filtered.map((task) => {
          const overdue = isOverdue(task)
          const displayStatus = overdue ? 'OVERDUE' : task.status
          const barColor = STATUS_BAR[displayStatus] || STATUS_BAR[TaskStatus.PENDING]
          return (
            <div
              key={task.id}
              onClick={() => onTaskDetail(task.id)}
              className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-2.5 px-3.5 py-3 pl-[18px] relative cursor-pointer active:opacity-80"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${barColor}`} />
              <div className="text-[16px] font-semibold mb-1 dark:text-white">{task.title}</div>
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1.5">
                  <Avatar name={task.owner?.name || '?'} size={24} />
                  <span className="text-[13px] text-gray-400">{task.owner?.name}</span>
                </div>
                <StatusPill status={displayStatus} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
