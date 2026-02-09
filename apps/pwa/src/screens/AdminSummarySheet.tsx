import { useState, useEffect } from 'react'
import Sheet from '../components/Sheet'
import StatusPill from '../components/StatusPill'
import Avatar from '../components/Avatar'
import { api } from '../services/api'
import { Task, TaskStatus } from '../types'
import { isPast, parseISO } from 'date-fns'

interface AdminSummarySheetProps {
  open: boolean
  onClose: () => void
  onTaskDetail: (taskId: string) => void
}

export default function AdminSummarySheet({ open, onClose, onTaskDetail }: AdminSummarySheetProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setLoading(true)
      api.get('/api/tasks').then((res) => {
        setTasks(res.data.data || [])
        setLoading(false)
      }).catch(() => setLoading(false))
    }
  }, [open])

  const pending = tasks.filter((t) => t.status === TaskStatus.PENDING || t.status === TaskStatus.IN_PROGRESS)
  const overdue = tasks.filter((t) => t.dueDate && isPast(parseISO(t.dueDate)) && t.status !== TaskStatus.APPROVED && t.status !== TaskStatus.COMPLETED)
  const reopened = tasks.filter((t) => t.status === TaskStatus.REOPENED)

  // Group by owner
  const byOwner = (list: Task[]) => {
    const map = new Map<string, Task[]>()
    list.forEach((t) => {
      const name = t.owner?.name || 'Unassigned'
      if (!map.has(name)) map.set(name, [])
      map.get(name)!.push(t)
    })
    return Array.from(map.entries())
  }

  return (
    <Sheet open={open} onClose={onClose} title="Daily Summary">
      {loading ? (
        <div className="text-center text-gray-400 py-10">Loading...</div>
      ) : (
        <div>
          {/* Summary cards */}
          <div className="flex gap-3 mb-4">
            <SummaryCard label="Pending" count={pending.length} color="bg-task-pending" />
            <SummaryCard label="Overdue" count={overdue.length} color="bg-task-overdue" />
            <SummaryCard label="Reopened" count={reopened.length} color="bg-task-reopened" />
          </div>

          {overdue.length > 0 && (
            <>
              <div className="text-[13px] text-gray-400 uppercase tracking-wide px-2 py-1.5">Overdue Tasks</div>
              {byOwner(overdue).map(([name, tasks]) => (
                <div key={name} className="mb-3">
                  <div className="flex items-center gap-2 px-2 py-1">
                    <Avatar name={name} size={20} />
                    <span className="text-[14px] font-medium dark:text-white">{name}</span>
                    <span className="text-[13px] text-gray-400">({tasks.length})</span>
                  </div>
                  {tasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { onTaskDetail(t.id); onClose() }}
                      className="w-full text-left bg-white dark:bg-[#1C1C1E] rounded-lg px-3 py-2 mb-1 active:opacity-80"
                    >
                      <div className="text-[15px] dark:text-white">{t.title}</div>
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}

          {pending.length > 0 && (
            <>
              <div className="text-[13px] text-gray-400 uppercase tracking-wide px-2 py-1.5 mt-2">Pending Tasks</div>
              {byOwner(pending).map(([name, tasks]) => (
                <div key={name} className="mb-3">
                  <div className="flex items-center gap-2 px-2 py-1">
                    <Avatar name={name} size={20} />
                    <span className="text-[14px] font-medium dark:text-white">{name}</span>
                    <span className="text-[13px] text-gray-400">({tasks.length})</span>
                  </div>
                  {tasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { onTaskDetail(t.id); onClose() }}
                      className="w-full text-left bg-white dark:bg-[#1C1C1E] rounded-lg px-3 py-2 mb-1 active:opacity-80"
                    >
                      <div className="text-[15px] dark:text-white">{t.title}</div>
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}

function SummaryCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex-1 bg-white dark:bg-[#1C1C1E] rounded-xl p-3 text-center">
      <div className={`text-2xl font-bold ${color.replace('bg-', 'text-')}`}>{count}</div>
      <div className="text-[12px] text-gray-400 mt-0.5">{label}</div>
    </div>
  )
}
