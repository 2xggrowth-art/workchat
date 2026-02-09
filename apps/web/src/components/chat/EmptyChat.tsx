export default function EmptyChat() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-[#ECE5DD] dark:bg-[#0B141A]">
      <div className="w-[260px] h-[260px] rounded-full bg-[#f0f2f5] dark:bg-[#202C33] flex items-center justify-center mb-8">
        <svg className="w-[100px] h-[100px] text-gray-400 dark:text-[#8696A0]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-3 12H7v-2h10v2zm0-3H7V9h10v2zm0-3H7V6h10v2z"/>
        </svg>
      </div>
      <h2 className="text-[32px] font-light text-gray-900 dark:text-[#E9EDEF] mb-3">WorkChat Web</h2>
      <p className="text-gray-500 dark:text-[#8696A0] text-sm text-center max-w-[480px] leading-6">
        Send and receive messages, convert chats to tasks, and track execution -- all in one place. Select a chat to get started.
      </p>
    </div>
  )
}
