import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/authStore'
import { UserRole } from '@workchat/shared'
import { api } from '../../services/api'

interface OrgSettingsPanelProps {
  onClose: () => void
}

interface OrgMember {
  id: string
  phone: string
  name: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'STAFF'
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED'
  createdAt: string
}

export default function OrgSettingsPanel({ onClose }: OrgSettingsPanelProps) {
  const user = useAuthStore((state) => state.user)
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN
  const queryClient = useQueryClient()

  const [orgCode, setOrgCode] = useState('')
  const [orgName, setOrgName] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState('')
  const [regenerating, setRegenerating] = useState(false)

  // Fetch org settings
  useEffect(() => {
    api.get('/api/org/settings').then((res) => {
      setOrgCode(res.data.data.orgCode)
      setOrgName(res.data.data.name)
      setInviteLink(res.data.data.inviteLink)
    }).catch(() => {})
  }, [])

  // Fetch members
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['org-members'],
    queryFn: async () => {
      const res = await api.get('/api/org/members')
      return res.data.data as OrgMember[]
    },
  })

  const members = membersData || []
  const superAdmins = members.filter(m => m.role === 'SUPER_ADMIN')
  const admins = members.filter(m => m.role === 'ADMIN')
  const staff = members.filter(m => m.role === 'STAFF')

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(''), 2000)
    })
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join WorkChat',
          text: `Join ${orgName} on WorkChat`,
          url: inviteLink,
        })
      } catch {}
    } else {
      copyToClipboard(inviteLink, 'link')
    }
  }

  const handleRegenerate = async () => {
    if (!confirm('Regenerate organization code? The old code will stop working.')) return
    setRegenerating(true)
    try {
      const res = await api.post('/api/org/regenerate-code')
      setOrgCode(res.data.data.orgCode)
      setInviteLink(res.data.data.inviteLink)
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to regenerate')
    } finally {
      setRegenerating(false)
    }
  }

  const handlePromote = async (id: string) => {
    try {
      await api.post(`/api/org/promote/${id}`)
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to promote')
    }
  }

  const handleDemote = async (id: string) => {
    try {
      await api.post(`/api/org/demote/${id}`)
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to demote')
    }
  }

  const handleSuspend = async (id: string) => {
    if (!confirm('Suspend this user?')) return
    try {
      await api.post(`/api/org/suspend/${id}`)
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to suspend')
    }
  }

  const handleActivate = async (id: string) => {
    try {
      await api.post(`/api/org/activate/${id}`)
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to activate')
    }
  }

  return (
    <div className="absolute inset-0 bg-white dark:bg-[#111B21] z-[200] flex flex-col">
      {/* Header */}
      <div className="bg-[#075E54] dark:bg-[#1f2c33] px-5 py-4 flex items-center gap-3">
        <button onClick={onClose} className="text-white text-lg">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        <h3 className="text-white text-lg font-medium">Organization Settings</h3>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Org Info Card */}
        {orgCode && (
          <div className="bg-[#f0f2f5] dark:bg-[#202C33] rounded-xl p-5 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#075E54] flex items-center justify-center text-white">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-[#E9EDEF]">{orgName}</h4>
                <span className="text-sm font-mono text-gray-500 dark:text-[#8696A0]">{orgCode}</span>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => copyToClipboard(orgCode, 'code')}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111B21] rounded-lg text-sm font-medium text-gray-700 dark:text-[#E9EDEF] hover:bg-gray-100 dark:hover:bg-[#2A3942] transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
                {copied === 'code' ? 'Copied!' : 'Copy Code'}
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg text-sm font-medium hover:bg-[#1da851] transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
                </svg>
                {copied === 'link' ? 'Copied!' : 'Share Invite Link'}
              </button>
              {isSuperAdmin && (
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  <svg className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                  </svg>
                  {regenerating ? 'Regenerating...' : 'Regenerate Code'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Members Section */}
        <h3 className="text-base font-semibold text-gray-900 dark:text-[#E9EDEF] mb-4">Members ({members.length})</h3>

        {membersLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {[
              { title: 'Super Admins', list: superAdmins },
              { title: 'Admins', list: admins },
              { title: 'Staff', list: staff },
            ].map(({ title, list }) => list.length > 0 && (
              <div key={title}>
                <div className="text-xs font-bold text-gray-500 dark:text-[#8696A0] uppercase tracking-wider mb-2">{title} ({list.length})</div>
                <div className="space-y-2">
                  {list.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 bg-[#f0f2f5] dark:bg-[#202C33] rounded-xl p-3">
                      <div className="w-10 h-10 rounded-full bg-[#128C7E] flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {member.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-[#E9EDEF] truncate">{member.name}</span>
                          {member.id === user?.id && <span className="text-[10px] text-gray-400">(You)</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-[#8696A0]">{member.phone}</span>
                          <StatusBadge status={member.status} />
                        </div>
                      </div>
                      {member.id !== user?.id && member.role !== 'SUPER_ADMIN' && (
                        <div className="flex gap-1.5 flex-shrink-0">
                          {member.role === 'STAFF' && (
                            <button
                              onClick={() => handlePromote(member.id)}
                              className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                              title="Promote to Admin"
                            >
                              Promote
                            </button>
                          )}
                          {member.role === 'ADMIN' && (
                            <button
                              onClick={() => handleDemote(member.id)}
                              className="px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-lg text-xs font-medium hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors"
                              title="Demote to Staff"
                            >
                              Demote
                            </button>
                          )}
                          {member.status === 'ACTIVE' ? (
                            <button
                              onClick={() => handleSuspend(member.id)}
                              className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                              title="Suspend"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivate(member.id)}
                              className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                              title="Activate"
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    ACTIVE: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    PENDING: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    SUSPENDED: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${styles[status as keyof typeof styles] || ''}`}>
      {status}
    </span>
  )
}
