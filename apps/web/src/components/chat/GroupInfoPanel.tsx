import { useState, useEffect } from 'react'
import { useAuthStore, useIsAdmin } from '../../stores/authStore'
import { api } from '../../services/api'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

interface GroupInfoPanelProps {
  chatId: string
  onClose: () => void
}

interface Member {
  userId: string
  role: string
  user: { id: string; name: string; phone: string; avatarUrl?: string }
}

interface OrgUser {
  id: string
  name: string
  phone: string
  role: string
  status: string
}

export default function GroupInfoPanel({ chatId, onClose }: GroupInfoPanelProps) {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [chat, setChat] = useState<any>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [showAddMembers, setShowAddMembers] = useState(false)
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [actionMenu, setActionMenu] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [loading, setLoading] = useState(false)

  const myMembership = members.find((m) => m.userId === user?.id)
  const isOwner = myMembership?.role === 'OWNER'
  const isChatAdmin = myMembership?.role === 'ADMIN' || isOwner

  useEffect(() => {
    api.get(`/api/chats/${chatId}`).then((res) => {
      setChat(res.data.data)
      setMembers(res.data.data?.members || [])
      setGroupName(res.data.data?.name || '')
    }).catch(() => {})
  }, [chatId])

  const refreshMembers = async () => {
    const res = await api.get(`/api/chats/${chatId}`)
    setMembers(res.data.data?.members || [])
  }

  const fetchOrgUsers = () => {
    api.get('/api/org/members').then((res) => {
      const memberIds = new Set(members.map((m) => m.userId))
      setOrgUsers((res.data.data || []).filter((u: OrgUser) => !memberIds.has(u.id) && u.status === 'ACTIVE'))
    }).catch(() => {})
  }

  const handleAddMembers = async () => {
    if (selected.length === 0) return
    setLoading(true)
    try {
      await api.post(`/api/chats/${chatId}/members`, { userIds: selected })
      await refreshMembers()
      setShowAddMembers(false)
      setSelected([])
      setSearch('')
    } catch {} finally {
      setLoading(false)
    }
  }

  const handleRemove = async (userId: string) => {
    try {
      await api.delete(`/api/chats/${chatId}/members/${userId}`)
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
      setActionMenu(null)
    } catch {}
  }

  const handlePromote = async (userId: string) => {
    try {
      await api.post(`/api/chats/${chatId}/members/${userId}/promote`)
      setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, role: 'ADMIN' } : m))
      setActionMenu(null)
    } catch {}
  }

  const handleDemote = async (userId: string) => {
    try {
      await api.post(`/api/chats/${chatId}/members/${userId}/demote`)
      setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, role: 'MEMBER' } : m))
      setActionMenu(null)
    } catch {}
  }

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this group?')) return
    try {
      await api.post(`/api/chats/${chatId}/leave`)
      queryClient.invalidateQueries({ queryKey: ['chats'] })
      navigate('/')
      onClose()
    } catch {}
  }

  const handleUpdateName = async () => {
    if (!groupName.trim() || groupName === chat?.name) {
      setEditingName(false)
      return
    }
    try {
      await api.patch(`/api/chats/${chatId}`, { name: groupName.trim() })
      setChat((prev: any) => ({ ...prev, name: groupName.trim() }))
      setEditingName(false)
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] })
      queryClient.invalidateQueries({ queryKey: ['chats'] })
    } catch {}
  }

  const filteredOrgUsers = search
    ? orgUsers.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search))
    : orgUsers

  const avatarColors = ['#075E54', '#128C7E', '#25D366', '#6a1b9a', '#c62828', '#1565c0', '#2e7d32', '#e65100']
  const getColor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length]

  const roleLabel = (role: string) => {
    if (role === 'OWNER') return 'Owner'
    if (role === 'ADMIN') return 'Admin'
    return ''
  }

  if (!chat) return null

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[340px] bg-[#f0f2f5] dark:bg-[#111b21] border-l border-[#e9edef] dark:border-[#313d45] z-20 flex flex-col shadow-lg">
      {/* Header */}
      <div className="bg-[#075E54] dark:bg-[#1f2c33] px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} className="text-white hover:bg-white/10 p-1.5 rounded-full">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
        <span className="text-white font-medium text-[16px]">Group Info</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Group header */}
        <div className="bg-white dark:bg-[#1f2c33] px-6 py-5 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-semibold" style={{ background: getColor(groupName) }}>
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          </div>
          {editingName ? (
            <div className="flex items-center gap-2 mt-3">
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleUpdateName()}
                className="text-[18px] font-medium text-center bg-transparent border-b-2 border-[#00a884] outline-none dark:text-white px-2 py-1"
              />
              <button onClick={handleUpdateName} className="text-[#00a884] hover:bg-[#00a884]/10 p-1 rounded-full">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              </button>
            </div>
          ) : (
            <button onClick={() => isChatAdmin && setEditingName(true)} className="text-[18px] font-medium mt-3 dark:text-white hover:underline">
              {groupName}
            </button>
          )}
          <span className="text-[13px] text-[#667781] mt-1">{members.length} members</span>
        </div>

        <div className="h-2" />

        {/* Members section */}
        <div className="bg-white dark:bg-[#1f2c33]">
          <div className="px-6 py-3 flex items-center justify-between">
            <span className="text-[13px] text-[#00a884] font-medium">{members.length} members</span>
            {isChatAdmin && (
              <button
                onClick={() => { fetchOrgUsers(); setShowAddMembers(!showAddMembers) }}
                className="text-[13px] text-[#00a884] font-medium flex items-center gap-1 hover:underline"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                Add member
              </button>
            )}
          </div>

          {/* Add members inline */}
          {showAddMembers && (
            <div className="px-4 pb-3 border-b border-[#e9edef] dark:border-[#313d45]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or phone"
                className="w-full px-3 py-2 rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[14px] outline-none dark:text-white mb-2"
              />
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {selected.map((id) => {
                    const u = orgUsers.find((x) => x.id === id)
                    return u ? (
                      <button key={id} onClick={() => setSelected((p) => p.filter((x) => x !== id))} className="text-[12px] bg-[#00a884]/15 text-[#00a884] px-2 py-0.5 rounded-full flex items-center gap-1">
                        {u.name} <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                      </button>
                    ) : null
                  })}
                </div>
              )}
              <div className="max-h-[200px] overflow-y-auto">
                {filteredOrgUsers.length === 0 && (
                  <div className="text-[13px] text-[#667781] py-3 text-center">
                    {orgUsers.length === 0 ? 'All org members are in this group' : 'No matching users'}
                  </div>
                )}
                {filteredOrgUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelected((p) => p.includes(u.id) ? p.filter((x) => x !== u.id) : [...p, u.id])}
                    className="flex items-center w-full gap-3 px-2 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#2a3942] rounded-lg"
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ background: getColor(u.name) }}>
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-[14px] dark:text-white">{u.name}</div>
                      <div className="text-[12px] text-[#667781]">{u.phone}</div>
                    </div>
                    {selected.includes(u.id) && (
                      <svg className="w-5 h-5 text-[#00a884]" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    )}
                  </button>
                ))}
              </div>
              {selected.length > 0 && (
                <button
                  onClick={handleAddMembers}
                  disabled={loading}
                  className="w-full mt-2 py-2 bg-[#00a884] text-white rounded-lg text-[14px] font-medium hover:bg-[#00a884]/90 disabled:opacity-50"
                >
                  {loading ? 'Adding...' : `Add ${selected.length} member${selected.length > 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          )}

          {/* Members list */}
          {members.map((member) => (
            <div key={member.userId} className="relative">
              <div className="flex items-center px-6 py-2.5 hover:bg-[#f5f6f6] dark:hover:bg-[#2a3942]">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold mr-3" style={{ background: getColor(member.user?.name || '?') }}>
                  {member.user?.avatarUrl
                    ? <span className="text-lg">{member.user.avatarUrl}</span>
                    : (member.user?.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] dark:text-white">
                    {member.user?.name}{member.userId === user?.id ? ' (You)' : ''}
                  </div>
                  <div className="text-[13px] text-[#667781]">{member.user?.phone}</div>
                </div>
                {roleLabel(member.role) && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full mr-2 ${member.role === 'OWNER' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                    {roleLabel(member.role)}
                  </span>
                )}
                {isChatAdmin && member.userId !== user?.id && member.role !== 'OWNER' && (
                  <button
                    onClick={() => setActionMenu(actionMenu === member.userId ? null : member.userId)}
                    className="p-1 text-[#667781] hover:bg-black/5 dark:hover:bg-white/5 rounded-full"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                  </button>
                )}
              </div>
              {/* Action dropdown */}
              {actionMenu === member.userId && (
                <div className="absolute right-6 top-12 bg-white dark:bg-[#233138] rounded-lg shadow-lg py-1 z-30 min-w-[160px] border border-[#e9edef] dark:border-[#313d45]">
                  {isOwner && member.role === 'MEMBER' && (
                    <button onClick={() => handlePromote(member.userId)} className="w-full text-left px-4 py-2 text-[14px] hover:bg-[#f5f6f6] dark:hover:bg-[#2a3942] dark:text-white">
                      Make group admin
                    </button>
                  )}
                  {isOwner && member.role === 'ADMIN' && (
                    <button onClick={() => handleDemote(member.userId)} className="w-full text-left px-4 py-2 text-[14px] hover:bg-[#f5f6f6] dark:hover:bg-[#2a3942] dark:text-white">
                      Dismiss as admin
                    </button>
                  )}
                  <button onClick={() => handleRemove(member.userId)} className="w-full text-left px-4 py-2 text-[14px] text-red-500 hover:bg-[#f5f6f6] dark:hover:bg-[#2a3942]">
                    Remove from group
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="h-2" />

        {/* Exit Group */}
        <div className="bg-white dark:bg-[#1f2c33]">
          <button onClick={handleLeave} className="w-full flex items-center gap-3 px-6 py-3 hover:bg-[#f5f6f6] dark:hover:bg-[#2a3942]">
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>
            <span className="text-[15px] text-red-500">Exit group</span>
          </button>
        </div>
        <div className="h-4" />
      </div>

      {/* Click outside to close action menu */}
      {actionMenu && <div className="fixed inset-0 z-20" onClick={() => setActionMenu(null)} />}
    </div>
  )
}
