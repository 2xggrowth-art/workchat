import { useState, useEffect } from 'react'
import { ChevronLeft, Check, X } from 'lucide-react'
import IOSNav from '../components/IOSNav'
import Avatar from '../components/Avatar'
import { api } from '../services/api'
import { User } from '../types'

interface ApproveUsersScreenProps {
  onBack: () => void
}

export default function ApproveUsersScreen({ onBack }: ApproveUsersScreenProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/auth/pending-users').then((res) => {
      setUsers(res.data.data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const approve = async (id: string) => {
    try {
      await api.post(`/api/auth/approve-user/${id}`)
      setUsers((prev) => prev.filter((u) => u.id !== id))
    } catch {
      // error
    }
  }

  const reject = async (id: string) => {
    try {
      await api.post(`/api/auth/reject-user/${id}`)
      setUsers((prev) => prev.filter((u) => u.id !== id))
    } catch {
      // error
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-100 dark:bg-[#1a1a1a] animate-slide-in z-30">
      <IOSNav
        title="Pending Approvals"
        left={
          <button onClick={onBack} className="text-blue-500 flex items-center gap-0.5 p-2">
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="text-[17px]">Back</span>
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch px-4 py-4">
        {loading && <div className="text-center text-gray-400 py-10">Loading...</div>}
        {!loading && users.length === 0 && (
          <div className="text-center text-gray-400 py-10 text-[15px]">No pending approvals</div>
        )}
        {users.map((user) => (
          <div key={user.id} className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-3 px-4 py-3">
            <div className="flex items-center">
              <Avatar name={user.name} size={44} className="mr-3" />
              <div className="flex-1 min-w-0">
                <div className="text-[17px] font-medium dark:text-white">{user.name}</div>
                <div className="text-[14px] text-gray-400">{user.phone}</div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => approve(user.id)}
                className="flex-1 py-2.5 rounded-lg bg-wgreen text-white text-[15px] font-semibold flex items-center justify-center gap-1.5 active:opacity-80"
              >
                <Check size={16} /> Approve
              </button>
              <button
                onClick={() => reject(user.id)}
                className="flex-1 py-2.5 rounded-lg bg-red-500 text-white text-[15px] font-semibold flex items-center justify-center gap-1.5 active:opacity-80"
              >
                <X size={16} /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
