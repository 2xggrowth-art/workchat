import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar'
import ChatPanel from '../components/chat/ChatPanel'
import EmptyChat from '../components/chat/EmptyChat'
import AdminSummaryPanel from '../components/admin/AdminSummaryPanel'
import UserApprovalPanel from '../components/admin/UserApprovalPanel'
import OrgSettingsPanel from '../components/admin/OrgSettingsPanel'

export type ActiveView = 'chats' | 'admin-summary' | 'user-approval' | 'org-settings'

export default function MainLayout() {
  const [activeView, setActiveView] = useState<ActiveView>('chats')

  return (
    <div className="h-screen flex bg-white dark:bg-[#111B21]">
      {/* Left Sidebar */}
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      {/* Right Panel */}
      <div className="flex-1 flex flex-col relative bg-[#ECE5DD] dark:bg-[#0B141A]">
        {activeView === 'admin-summary' && (
          <AdminSummaryPanel onClose={() => setActiveView('chats')} />
        )}
        {activeView === 'user-approval' && (
          <UserApprovalPanel onClose={() => setActiveView('chats')} />
        )}
        {activeView === 'org-settings' && (
          <OrgSettingsPanel onClose={() => setActiveView('chats')} />
        )}
        {activeView === 'chats' && (
          <Routes>
            <Route path="/" element={<EmptyChat />} />
            <Route path="/chat/:chatId" element={<ChatPanel />} />
          </Routes>
        )}
      </div>
    </div>
  )
}
