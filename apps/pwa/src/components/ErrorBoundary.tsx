import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-[#1a1a1a] p-6 text-center">
          <div className="text-5xl mb-4">😵</div>
          <h2 className="text-xl font-semibold dark:text-white mb-2">Something went wrong</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">The app ran into an unexpected error.</p>
          <button
            onClick={() => {
              this.setState({ hasError: false })
              window.location.reload()
            }}
            className="px-6 py-2.5 bg-wgreen text-white rounded-full font-medium"
          >
            Reload App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
