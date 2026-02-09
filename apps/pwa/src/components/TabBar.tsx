import { MessageSquare, CheckSquare, Settings, BarChart3 } from 'lucide-react'

interface TabBarProps {
  active: string
  onTabChange: (tab: string) => void
  unreadCount?: number
  onSummary?: () => void
}

export default function TabBar({ active, onTabChange, unreadCount, onSummary }: TabBarProps) {
  const tabs = [
    { id: 'chats', label: 'Chats', icon: MessageSquare, badge: unreadCount },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    ...(onSummary ? [{ id: 'summary', label: 'Summary', icon: BarChart3 }] : []),
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="ios-blur border-t border-black/[0.12] dark:border-white/[0.15] pb-safe shrink-0 flex">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => tab.id === 'summary' && onSummary ? onSummary() : onTabChange(tab.id)}
          className={`flex-1 flex flex-col items-center pt-1.5 pb-0.5 gap-0.5 min-h-[50px] ${
            active === tab.id ? 'text-blue-500' : 'text-gray-400'
          }`}
        >
          <div className="relative">
            <tab.icon size={24} strokeWidth={2} />
            {tab.badge ? (
              <span className="absolute -top-0.5 -right-2 bg-red-500 text-white text-[11px] font-semibold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                {tab.badge}
              </span>
            ) : null}
          </div>
          <span className="text-[10px]">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}
