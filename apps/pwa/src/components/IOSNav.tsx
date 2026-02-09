import { ReactNode } from 'react'

interface IOSNavProps {
  title?: string
  largeTitle?: string
  left?: ReactNode
  right?: ReactNode
  children?: ReactNode
}

export default function IOSNav({ title, largeTitle, left, right, children }: IOSNavProps) {
  return (
    <div className="ios-blur border-b border-black/[0.12] dark:border-white/[0.15] pt-safe shrink-0 z-10">
      <div className="flex items-center justify-between h-11 px-4">
        <div className="min-w-[60px] flex items-center">{left}</div>
        {title && <div className="text-[17px] font-semibold text-center flex-1 truncate">{title}</div>}
        {!title && <div className="flex-1" />}
        <div className="min-w-[60px] flex items-center justify-end">{right}</div>
      </div>
      {largeTitle && (
        <div className="px-4 pb-2">
          <div className="text-[34px] font-bold tracking-tight">{largeTitle}</div>
        </div>
      )}
      {children}
    </div>
  )
}
