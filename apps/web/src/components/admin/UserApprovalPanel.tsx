import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'

interface UserApprovalPanelProps {
  onClose: () => void
}

export default function UserApprovalPanel({ onClose }: UserApprovalPanelProps) {
  const queryClient = useQueryClient()

  const { data: pendingUsers, isLoading } = useQuery({
    queryKey: ['pending-users'],
    queryFn: async () => {
      const response = await api.get('/api/auth/pending-users')
      return response.data.data
    },
  })

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/api/auth/approve-user/${userId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-users'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/api/auth/reject-user/${userId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-users'] })
    },
  })

  const users = pendingUsers || []

  return (
    <div className="absolute inset-0 bg-white dark:bg-[#111B21] z-[200] flex flex-col">
      {/* Header */}
      <div className="bg-[#075E54] dark:bg-[#1f2c33] px-5 py-4 flex items-center gap-3">
        <button onClick={onClose} className="text-white text-lg">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        <h3 className="text-white text-lg font-medium">Pending User Approvals</h3>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-[#8696A0]">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            <p className="text-sm">No pending registrations</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user: any) => (
              <div key={user.id} className="flex items-center gap-4 bg-[#f0f2f5] dark:bg-[#202C33] rounded-xl p-4">
                <div className="w-12 h-12 rounded-full bg-[#128C7E] flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                  {user.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 dark:text-[#E9EDEF]">{user.name}</h4>
                  <p className="text-sm text-gray-500 dark:text-[#8696A0]">{user.phone}</p>
                  <p className="text-xs text-gray-400 dark:text-[#667781]">
                    Registered {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => approveMutation.mutate(user.id)}
                    disabled={approveMutation.isPending}
                    className="px-4 py-2 bg-[#4CAF50] text-white rounded-lg text-sm font-medium hover:bg-[#388e3c] transition-colors disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(user.id)}
                    disabled={rejectMutation.isPending}
                    className="px-4 py-2 bg-[#F44336] text-white rounded-lg text-sm font-medium hover:bg-[#d32f2f] transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
