import { ReactNode, useEffect, useState } from 'react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  headerRight?: ReactNode
  children: ReactNode
}

export default function Sheet({ open, onClose, title, headerRight, children }: SheetProps) {
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!open) setClosing(false)
  }, [open])

  if (!open && !closing) return null

  const handleClose = () => {
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 280)
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end"
      onClick={handleClose}
    >
      <div
        className={`bg-gray-100 dark:bg-[#2C2C2E] w-full max-h-[85vh] rounded-t-[20px] overflow-hidden flex flex-col ${
          closing ? 'animate-sheet-down' : 'animate-sheet-up'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-9 h-[5px] rounded-full bg-gray-400 mx-auto mt-2 mb-1 shrink-0" />
        <div className="flex items-center justify-between px-4 py-2 pb-3 shrink-0">
          <button onClick={handleClose} className="text-blue-500 text-[17px] py-2 px-1 min-w-[50px]">
            Close
          </button>
          {title && <div className="text-[17px] font-semibold">{title}</div>}
          <div className="min-w-[50px] flex justify-end">{headerRight}</div>
        </div>
        <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch px-4 pb-5 pb-safe">
          {children}
        </div>
      </div>
    </div>
  )
}
