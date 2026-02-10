import { useState, useEffect } from 'react'
import { ChevronLeft, Shield, ShieldOff, UserX, UserCheck } from 'lucide-react'
import IOSNav from '../components/IOSNav'
import Avatar from '../components/Avatar'
import { useAuthStore } from '../stores/authStore'
import { api } from '../services/api'

interface OrgMember {
  id: string
  phone: string
  name: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'STAFF'
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED'
  createdAt: string
}

interface MembersScreenProps {
  onBack: () => void
}

export default function MembersScreen({ onBack }: MembersScreenProps) {
  const { user } = useAuthStore()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMembers = async () => {
    try {
      const res = await api.get('/api/org/members')
      setMembers(res.data.data)
    } catch (err) {
      console.error('Failed to fetch members:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMembers() }, [])

  const handlePromote = async (id: string) => {
    try {
      await api.post(`/api/org/promote/${id}`)
      fetchMembers()
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to promote')
    }
  }

  const handleDemote = async (id: string) => {
    try {
      await api.post(`/api/org/demote/${id}`)
      fetchMembers()
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to demote')
    }
  }

  const handleSuspend = async (id: string) => {
    if (!confirm('Suspend this user?')) return
    try {
      await api.post(`/api/org/suspend/${id}`)
      fetchMembers()
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to suspend')
    }
  }

  const handleActivate = async (id: string) => {
    try {
      await api.post(`/api/org/activate/${id}`)
      fetchMembers()
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to activate')
    }
  }

  const superAdmins = members.filter(m => m.role === 'SUPER_ADMIN')
  const admins = members.filter(m => m.role === 'ADMIN')
  const staff = members.filter(m => m.role === 'STAFF')
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  return (
    <div className="absolute inset-0 bg-gray-100 dark:bg-[#1a1a1a] z-[100] flex flex-col">
      <IOSNav title="Members" left={<button onClick={onBack} className="text-teal flex items-center gap-0.5 text-[17px]"><ChevronLeft size={20} /> Back</button>} />
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-8 h-8 border-2 border-teal border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {[
              { title: 'Super Admins', list: superAdmins },
              { title: 'Admins', list: admins },
              { title: 'Staff', list: staff },
            ].map(({ title, list }) => list.length > 0 && (
              <div key={title} className="mb-4">
                <div className="text-[13px] text-gray-400 uppercase tracking-wide px-1 py-1.5">{title} ({list.length})</div>
                <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden">
                  {list.map((member, i) => (
                    <div key={member.id}>
                      {i > 0 && <div className="h-px bg-black/[0.08] dark:bg-white/[0.1] ml-[60px]" />}
                      <div className="flex items-center px-4 py-3">
                        <Avatar name={member.name} size={40} />
                        <div className="flex-1 ml-3 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[15px] font-medium dark:text-white truncate">{member.name}</span>
                            {member.id === user?.id && <span className="text-[11px] text-gray-400">(You)</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] text-gray-400">{member.phone}</span>
                            <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                              member.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              member.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>{member.status}</span>
                          </div>
                        </div>
                        {canManage && member.id !== user?.id && member.role !== 'SUPER_ADMIN' && (
                          <div className="flex gap-1.5 ml-2">
                            {member.role === 'STAFF' && (
                              <button onClick={() => handlePromote(member.id)} className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600" title="Promote to Admin">
                                <Shield size={16} />
                              </button>
                            )}
                            {member.role === 'ADMIN' && (
                              <button onClick={() => handleDemote(member.id)} className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600" title="Demote to Staff">
                                <ShieldOff size={16} />
                              </button>
                            )}
                            {member.status === 'ACTIVE' ? (
                              <button onClick={() => handleSuspend(member.id)} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500" title="Suspend">
                                <UserX size={16} />
                              </button>
                            ) : (
                              <button onClick={() => handleActivate(member.id)} className="p-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600" title="Activate">
                                <UserCheck size={16} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
