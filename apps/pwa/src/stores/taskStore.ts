import { create } from 'zustand'
import { Task } from '../types'
import { api } from '../services/api'

interface TaskState {
  tasks: Task[]
  loading: boolean
  fetchTasks: () => Promise<void>
  updateTaskStatus: (taskId: string, status: string) => Promise<void>
}

export const useTaskStore = create<TaskState>()((set) => ({
  tasks: [],
  loading: false,

  fetchTasks: async () => {
    set({ loading: true })
    try {
      const response = await api.get('/api/tasks')
      set({ tasks: response.data.data || [], loading: false })
    } catch {
      set({ loading: false })
    }
  },

  updateTaskStatus: async (taskId: string, status: string) => {
    const response = await api.patch(`/api/tasks/${taskId}/status`, { status })
    const updated = response.data.data
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...updated } : t)),
    }))
  },
}))
