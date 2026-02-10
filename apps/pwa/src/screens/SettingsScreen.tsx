import { useState, useEffect } from 'react'
import { Bell, Sun, Info, HelpCircle, ChevronRight, LogOut, UserCheck, Building2, Copy, Share2, Users, RefreshCw } from 'lucide-react'
import IOSNav from '../components/IOSNav'
import Avatar from '../components/Avatar'
import { useAuthStore } from '../stores/authStore'
import { api } from '../services/api'

interface SettingsScreenProps {
  onApproveUsers: () => void
  onProfile: () => void
  onManageMembers: () => void
}

export default function SettingsScreen({ onApproveUsers, onProfile, onManageMembers }: SettingsScreenProps) {
  const { user, logout } = useAuthStore()
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const [orgCode, setOrgCode] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [orgName, setOrgName] = useState('')
  const [copied, setCopied] = useState('')
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    if (isAdmin) {
      api.get('/api/org/settings').then((res) => {
        setOrgCode(res.data.data.orgCode)
        setInviteLink(res.data.data.inviteLink)
        setOrgName(res.data.data.name)
      }).catch(() => {})
    }
  }, [isAdmin])

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

  return (
    <div className="flex flex-col h-full">
      <IOSNav title="Settings" />
      <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch">
        {/* Profile */}
        <div className="flex flex-col items-center py-5 cursor-pointer" onClick={onProfile}>
          <Avatar name={user?.name || '?'} avatarUrl={user?.avatarUrl} size={80} />
          <div className="text-[22px] font-semibold mt-2 dark:text-white">{user?.name}</div>
          <div className="text-[15px] text-gray-400">{user?.phone}</div>
        </div>

        <div className="px-4">
          {isAdmin && (
            <>
              {/* Organization Section */}
              <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">Organization</div>
              <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4">
                {/* Org Name & Code */}
                {orgCode && (
                  <>
                    <div className="flex items-center px-4 py-3 min-h-[44px]">
                      <div className="w-[30px] h-[30px] rounded-[7px] bg-teal flex items-center justify-center mr-3">
                        <Building2 size={18} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <span className="text-[17px] dark:text-white">{orgName}</span>
                        <div className="text-[13px] text-gray-400 font-mono">{orgCode}</div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(orgCode, 'code')}
                        className="p-2 rounded-lg active:bg-gray-100 dark:active:bg-gray-800"
                      >
                        <Copy size={16} className={copied === 'code' ? 'text-green-500' : 'text-gray-400'} />
                      </button>
                    </div>
                    <div className="h-px bg-black/[0.08] dark:bg-white/[0.1] ml-[58px]" />
                  </>
                )}

                {/* Share Invite Link */}
                <button onClick={handleShare} className="flex items-center w-full px-4 py-3 min-h-[44px] active:bg-gray-100 dark:active:bg-gray-800">
                  <div className="w-[30px] h-[30px] rounded-[7px] bg-green-500 flex items-center justify-center mr-3">
                    <Share2 size={18} className="text-white" />
                  </div>
                  <span className="text-[17px] flex-1 text-left dark:text-white">Share Invite Link</span>
                  {copied === 'link' && <span className="text-[13px] text-green-500 mr-2">Copied!</span>}
                </button>

                {/* Regenerate Code (Super Admin only) */}
                {isSuperAdmin && (
                  <>
                    <div className="h-px bg-black/[0.08] dark:bg-white/[0.1] ml-[58px]" />
                    <button onClick={handleRegenerate} disabled={regenerating} className="flex items-center w-full px-4 py-3 min-h-[44px] active:bg-gray-100 dark:active:bg-gray-800 disabled:opacity-50">
                      <div className="w-[30px] h-[30px] rounded-[7px] bg-orange-500 flex items-center justify-center mr-3">
                        <RefreshCw size={18} className={`text-white ${regenerating ? 'animate-spin' : ''}`} />
                      </div>
                      <span className="text-[17px] flex-1 text-left dark:text-white">Regenerate Code</span>
                    </button>
                  </>
                )}

                {/* Manage Members */}
                <div className="h-px bg-black/[0.08] dark:bg-white/[0.1] ml-[58px]" />
                <button onClick={onManageMembers} className="flex items-center w-full px-4 py-3 min-h-[44px] active:bg-gray-100 dark:active:bg-gray-800">
                  <div className="w-[30px] h-[30px] rounded-[7px] bg-purple-500 flex items-center justify-center mr-3">
                    <Users size={18} className="text-white" />
                  </div>
                  <span className="text-[17px] flex-1 text-left dark:text-white">Manage Members</span>
                  <ChevronRight size={14} className="text-gray-400" />
                </button>
              </div>

              {/* Admin Section */}
              <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">Admin</div>
              <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4">
                <button onClick={onApproveUsers} className="flex items-center w-full px-4 py-3 min-h-[44px] active:bg-gray-100 dark:active:bg-gray-800">
                  <div className="w-[30px] h-[30px] rounded-[7px] bg-blue-500 flex items-center justify-center mr-3">
                    <UserCheck size={18} className="text-white" />
                  </div>
                  <span className="text-[17px] flex-1 text-left dark:text-white">Approve Users</span>
                  <ChevronRight size={14} className="text-gray-400" />
                </button>
              </div>
            </>
          )}

          <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">Preferences</div>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4">
            <div className="flex items-center px-4 py-3 min-h-[44px]">
              <div className="w-[30px] h-[30px] rounded-[7px] bg-red-500 flex items-center justify-center mr-3">
                <Bell size={18} className="text-white" />
              </div>
              <span className="text-[17px] flex-1 dark:text-white">Notifications</span>
              <ToggleSwitch defaultOn onChange={(on) => {
                if (on && 'Notification' in window) {
                  Notification.requestPermission()
                }
              }} />
            </div>
            <div className="h-px bg-black/[0.08] dark:bg-white/[0.1] ml-[58px]" />
            <div className="flex items-center px-4 py-3 min-h-[44px]">
              <div className="w-[30px] h-[30px] rounded-[7px] bg-purple-500 flex items-center justify-center mr-3">
                <Sun size={18} className="text-white" />
              </div>
              <span className="text-[17px] flex-1 dark:text-white">Dark Mode</span>
              <ToggleSwitch defaultOn={document.documentElement.classList.contains('dark')} onChange={(on) => {
                document.documentElement.classList.toggle('dark', on)
                localStorage.setItem('wc_dark_mode', on ? '1' : '0')
              }} />
            </div>
          </div>

          <div className="text-[13px] text-gray-400 uppercase tracking-wide px-4 py-1.5">About</div>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden mb-4">
            <div className="flex items-center px-4 py-3 min-h-[44px]">
              <div className="w-[30px] h-[30px] rounded-[7px] bg-blue-500 flex items-center justify-center mr-3">
                <Info size={18} className="text-white" />
              </div>
              <span className="text-[17px] flex-1 dark:text-white">Version</span>
              <span className="text-[17px] text-gray-400">1.0.0 (MVP)</span>
            </div>
            <div className="h-px bg-black/[0.08] dark:bg-white/[0.1] ml-[58px]" />
            <div className="flex items-center px-4 py-3 min-h-[44px]">
              <div className="w-[30px] h-[30px] rounded-[7px] bg-green-500 flex items-center justify-center mr-3">
                <HelpCircle size={18} className="text-white" />
              </div>
              <span className="text-[17px] flex-1 dark:text-white">Help</span>
              <ChevronRight size={14} className="text-gray-400" />
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full bg-white dark:bg-[#1C1C1E] rounded-xl py-3.5 text-red-500 text-[17px] font-semibold text-center mb-8 active:opacity-80"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  )
}

function ToggleSwitch({ defaultOn = false, onChange }: { defaultOn?: boolean; onChange?: (on: boolean) => void }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <button
      onClick={() => { const next = !on; setOn(next); onChange?.(next) }}
      className={`w-[51px] h-[31px] rounded-full relative shrink-0 transition-colors ${on ? 'bg-wgreen' : 'bg-gray-300'}`}
    >
      <div
        className={`absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-5' : ''
        }`}
      />
    </button>
  )
}
