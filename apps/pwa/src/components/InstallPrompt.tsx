import { useState, useEffect } from 'react'
import { MessageSquare, Share } from 'lucide-react'

export default function InstallPrompt() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone
    const dismissed = localStorage.getItem('wc_install_dismissed')
    if (!isStandalone && !dismissed) {
      setShow(true)
    }
  }, [])

  if (!show) return null

  const dismiss = () => {
    setShow(false)
    localStorage.setItem('wc_install_dismissed', '1')
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6">
      <div className="bg-white dark:bg-[#1C1C1E] rounded-[20px] p-7 text-center max-w-[320px] w-full">
        <div className="w-16 h-16 rounded-2xl bg-teal flex items-center justify-center mx-auto mb-4">
          <MessageSquare size={36} className="text-white" />
        </div>
        <div className="text-xl font-bold mb-2 dark:text-white">Install WorkChat</div>
        <div className="text-[15px] text-gray-400 mb-5 leading-relaxed">
          Add WorkChat to your home screen for the best experience.
        </div>
        <div className="text-left space-y-0 divide-y divide-gray-200 dark:divide-gray-700">
          <div className="flex items-center gap-2.5 py-2.5">
            <div className="w-7 h-7 rounded-full bg-teal text-white text-sm font-bold flex items-center justify-center shrink-0">1</div>
            <div className="text-[15px] dark:text-white">
              Tap the Share button <Share size={16} className="inline text-blue-500 align-[-3px]" /> in Safari
            </div>
          </div>
          <div className="flex items-center gap-2.5 py-2.5">
            <div className="w-7 h-7 rounded-full bg-teal text-white text-sm font-bold flex items-center justify-center shrink-0">2</div>
            <div className="text-[15px] dark:text-white">Scroll down and tap <strong>"Add to Home Screen"</strong></div>
          </div>
          <div className="flex items-center gap-2.5 py-2.5">
            <div className="w-7 h-7 rounded-full bg-teal text-white text-sm font-bold flex items-center justify-center shrink-0">3</div>
            <div className="text-[15px] dark:text-white">Tap <strong>"Add"</strong> in the top right</div>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="mt-5 w-full py-3.5 rounded-xl bg-teal text-white text-[17px] font-semibold active:opacity-80"
        >
          Got It
        </button>
      </div>
    </div>
  )
}
