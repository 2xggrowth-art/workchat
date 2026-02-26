import { useState, useEffect } from 'react'
import { ChevronLeft, UserPlus, LogOut, Shield, Crown, X, Check, MoreVertical } from 'lucide-react'
import IOSNav from '../components/IOSNav'
import Avatar from '../components/Avatar'
import { Chat, ChatMemberRole, User } from '../types'
import { useAuthStore } from '../stores/authStore'
import { api } from '../services/api'

interface GroupInfoScreenProps {
  chat: Chat
  onBack: () => void
  onExitGroup?: () => void
}

export default function GroupInfoScreen({ chat, onBack, onExitGroup }: GroupInfoScreenProps) {
  const user = useAuthStore((s) => s.user)
  const [members, setMembers] = useState(chat.members || [])
  const [showAddMembers, setShowAddMembers] = useState(false)
  const [search, setSearch] = useState('')
  const [orgUsers, setOrgUsers] = useState<User[]>([])
  const [selectedAction, setSelectedAction] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [groupName, setGroupName] = useState(chat.name || '')
  const [loading, setLoading] = useState(false)

  const myMembership = members.find((m) => m.userId === user?.id)
  const isOwner = myMembership?.role === ChatMemberRole.OWNER
  const isAdmin = myMembership?.role === ChatMemberRole.ADMIN || isOwner

  useEffect(() => {
    api.get(`/api/chats/${chat.id}`).then((res) => {
      if (res.data.data?.members) setMembers(res.data.data.members)
    }).catch(() => {})
  }, [chat.id])

  const fetchOrgUsers = () => {
    api.get('/api/org/members').then((res) => {
      const memberIds = new Set(members.map((m) => m.userId))
      setOrgUsers((res.data.data || []).filter((u: User) => !memberIds.has(u.id) && u.status === 'ACTIVE'))
    }).catch(() => {})
  }

  const handleAddMembers = async (userIds: string[]) => {
    if (userIds.length === 0) return
    setLoading(true)
    try {
      await api.post(`/api/chats/${chat.id}/members`, { userIds })
      const res = await api.get(`/api/chats/${chat.id}`)
      if (res.data.data?.members) setMembers(res.data.data.members)
      setShowAddMembers(false)
    } catch {} finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    try {
      await api.delete(`/api/chats/${chat.id}/members/${userId}`)
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
      setSelectedAction(null)
    } catch {}
  }

  const handlePromote = async (userId: string) => {
    try {
      await api.post(`/api/chats/${chat.id}/members/${userId}/promote`)
      setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, role: ChatMemberRole.ADMIN } : m))
      setSelectedAction(null)
    } catch {}
  }

  const handleDemote = async (userId: string) => {
    try {
      await api.post(`/api/chats/${chat.id}/members/${userId}/demote`)
      setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, role: ChatMemberRole.MEMBER } : m))
      setSelectedAction(null)
    } catch {}
  }

  const handleLeaveGroup = async () => {
    if (!confirm('Are you sure you want to leave this group?')) return
    try {
      await api.post(`/api/chats/${chat.id}/leave`)
      onExitGroup?.()
    } catch {}
  }

  const handleUpdateName = async () => {
    if (!groupName.trim() || groupName === chat.name) {
      setEditingName(false)
      return
    }
    try {
      await api.patch(`/api/chats/${chat.id}`, { name: groupName.trim() })
      setEditingName(false)
    } catch {}
  }

  const roleIcon = (role: string) => {
    if (role === ChatMemberRole.OWNER) return <Crown size={14} className="text-yellow-500" />
    if (role === ChatMemberRole.ADMIN) return <Shield size={14} className="text-blue-500" />
    return null
  }

  const roleLabel = (role: string) => {
    if (role === ChatMemberRole.OWNER) return 'Owner'
    if (role === ChatMemberRole.ADMIN) return 'Admin'
    return 'Member'
  }

  // Add Members Sub-screen
  if (showAddMembers) {
    return <AddMembersScreen
      orgUsers={orgUsers}
      search={search}
      onSearchChange={setSearch}
      onBack={() => setShowAddMembers(false)}
      onAdd={handleAddMembers}
      loading={loading}
    />
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-100 dark:bg-[#1a1a1a] animate-slide-in z-30">
      <IOSNav
        title="Group Info"
        left={
          <button onClick={onBack} className="text-blue-500 flex items-center gap-0.5 p-2">
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="text-[17px]">Back</span>
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch">
        {/* Group header */}
        <div className="flex flex-col items-center py-6">
          <Avatar name={groupName} size={80} />
          {editingName ? (
            <div className="flex items-center gap-2 mt-3 px-8">
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                autoFocus
                className="text-[20px] font-semibold text-center bg-white dark:bg-[#1C1C1E] dark:text-white rounded-lg px-3 py-1.5 border border-gray-300 dark:border-gray-600 outline-none"
              />
              <button onClick={handleUpdateName} className="text-wgreen"><Check size={22} /></button>
              <button onClick={() => { setGroupName(chat.name || ''); setEditingName(false) }} className="text-gray-400"><X size={22} /></button>
            </div>
          ) : (
            <button
              onClick={() => isAdmin && setEditingName(true)}
              className="text-[22px] font-semibold mt-3 dark:text-white"
            >
              {groupName}
            </button>
          )}
          <div className="text-[15px] text-gray-400 mt-1">{members.length} members</div>
        </div>

        {/* Add Members Button */}
        {isAdmin && (
          <div className="px-4 mb-4">
            <button
              onClick={() => { fetchOrgUsers(); setShowAddMembers(true) }}
              className="w-full flex items-center gap-3 bg-white dark:bg-[#1C1C1E] rounded-xl px-4 py-3 active:bg-gray-100 dark:active:bg-gray-800"
            >
              <div className="w-10 h-10 rounded-full bg-wgreen/15 flex items-center justify-center">
                <UserPlus size={20} className="text-wgreen" />
              </div>
              <span className="text-[17px] text-wgreen font-medium">Add Members</span>
            </button>
          </div>
        )}

        {/* Members */}
        <div className="px-4">
          <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">
            Members ({members.length})
          </div>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden">
            {members.map((member, i) => (
              <div key={member.userId}>
                <div className="flex items-center px-4 py-2.5">
                  <Avatar name={member.user?.name || '?'} avatarUrl={member.user?.avatarUrl} size={40} className="mr-3" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[17px] dark:text-white">
                        {member.user?.name}{member.userId === user?.id ? ' (You)' : ''}
                      </span>
                      {roleIcon(member.role)}
                    </div>
                    <div className="text-[14px] text-gray-400">{member.user?.phone}</div>
                  </div>
                  <span className="text-[13px] text-gray-400 mr-2">{roleLabel(member.role)}</span>
                  {/* Action menu for admins (can't act on yourself or owner if you're admin) */}
                  {isAdmin && member.userId !== user?.id && !(member.role === ChatMemberRole.OWNER && !isOwner) && (
                    <button
                      onClick={() => setSelectedAction(selectedAction === member.userId ? null : member.userId)}
                      className="p-1 text-gray-400"
                    >
                      <MoreVertical size={18} />
                    </button>
                  )}
                </div>
                {/* Action dropdown */}
                {selectedAction === member.userId && (
                  <div className="bg-gray-50 dark:bg-[#2C2C2E] px-4 py-2 flex flex-wrap gap-2">
                    {isOwner && member.role === ChatMemberRole.MEMBER && (
                      <button onClick={() => handlePromote(member.userId)} className="text-[14px] text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg font-medium">
                        Make Admin
                      </button>
                    )}
                    {isOwner && member.role === ChatMemberRole.ADMIN && (
                      <button onClick={() => handleDemote(member.userId)} className="text-[14px] text-orange-500 bg-orange-50 dark:bg-orange-900/30 px-3 py-1.5 rounded-lg font-medium">
                        Dismiss Admin
                      </button>
                    )}
                    <button onClick={() => handleRemoveMember(member.userId)} className="text-[14px] text-red-500 bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded-lg font-medium">
                      Remove
                    </button>
                  </div>
                )}
                {i < members.length - 1 && <div className="h-px bg-black/[0.06] dark:bg-white/[0.06] ml-[68px]" />}
              </div>
            ))}
          </div>
        </div>

        {/* Exit Group */}
        <div className="px-4 mt-6 mb-8">
          <button
            onClick={handleLeaveGroup}
            className="w-full flex items-center gap-3 bg-white dark:bg-[#1C1C1E] rounded-xl px-4 py-3 active:bg-gray-100 dark:active:bg-gray-800"
          >
            <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
              <LogOut size={20} className="text-red-500" />
            </div>
            <span className="text-[17px] text-red-500 font-medium">Exit Group</span>
          </button>
        </div>
      </div>

      {/* Tap outside to close action menu */}
      {selectedAction && (
        <div className="fixed inset-0 z-10" onClick={() => setSelectedAction(null)} />
      )}
    </div>
  )
}

// Sub-screen: Add Members
function AddMembersScreen({ orgUsers, search, onSearchChange, onBack, onAdd, loading }: {
  orgUsers: User[]
  search: string
  onSearchChange: (v: string) => void
  onBack: () => void
  onAdd: (ids: string[]) => void
  loading: boolean
}) {
  const [selected, setSelected] = useState<string[]>([])

  const filtered = search
    ? orgUsers.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.phone?.includes(search))
    : orgUsers

  const toggleUser = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-gray-100 dark:bg-[#1a1a1a] animate-slide-in z-30">
      <IOSNav
        title="Add Members"
        left={
          <button onClick={onBack} className="text-blue-500 flex items-center gap-0.5 p-2">
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
        }
        right={
          selected.length > 0 ? (
            <button onClick={() => onAdd(selected)} disabled={loading} className="text-blue-500 font-semibold text-[17px] p-2 disabled:opacity-50">
              Add ({selected.length})
            </button>
          ) : undefined
        }
      />
      {/* Search */}
      <div className="px-4 py-2">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full bg-white dark:bg-[#1C1C1E] rounded-xl px-4 py-2.5 text-[16px] border-none outline-none dark:text-white placeholder-gray-400"
        />
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 py-2">
          {selected.map((id) => {
            const u = orgUsers.find((x) => x.id === id)
            return u ? (
              <button key={id} onClick={() => toggleUser(id)} className="flex items-center gap-1 bg-wgreen/15 text-wgreen text-[13px] font-medium px-2.5 py-1 rounded-full">
                {u.name} <X size={12} />
              </button>
            ) : null
          })}
        </div>
      )}

      {/* User list */}
      <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch">
        {filtered.length === 0 && (
          <div className="text-center text-gray-400 py-10 text-[15px]">
            {orgUsers.length === 0 ? 'All org members are already in this group' : 'No matching users'}
          </div>
        )}
        <div className="bg-white dark:bg-[#1C1C1E]">
          {filtered.map((u, i) => (
            <div key={u.id}>
              <button
                onClick={() => toggleUser(u.id)}
                className="flex items-center w-full px-4 py-2.5 active:bg-gray-100 dark:active:bg-gray-800"
              >
                <Avatar name={u.name} size={40} className="mr-3" />
                <div className="text-left flex-1">
                  <div className="text-[17px] dark:text-white">{u.name}</div>
                  <div className="text-[14px] text-gray-400">{u.phone}</div>
                </div>
                {selected.includes(u.id) && (
                  <div className="w-6 h-6 rounded-full bg-wgreen flex items-center justify-center">
                    <Check size={14} className="text-white" strokeWidth={3} />
                  </div>
                )}
              </button>
              {i < filtered.length - 1 && <div className="h-px bg-black/[0.06] dark:bg-white/[0.06] ml-[68px]" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
