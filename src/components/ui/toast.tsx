'use client'
import { createContext, useContext, useState, useCallback } from 'react'
import { IconCheckCircle, IconXCircle, IconAlertTriangle, IconInfo } from './icon'

type ToastType = 'success' | 'error' | 'warning' | 'info'
interface ToastItem { id: number; type: ToastType; message: string }

const ToastContext = createContext<{
  toast: (type: ToastType, message: string) => void
}>({ toast: () => {} })

export function useToast() { return useContext(ToastContext) }

const icons: Record<ToastType, React.ReactNode> = {
  success: <IconCheckCircle size={16} />,
  error: <IconXCircle size={16} />,
  warning: <IconAlertTriangle size={16} />,
  info: <IconInfo size={16} />,
}

const colors: Record<ToastType, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  warning: 'bg-yellow-600',
  info: 'bg-blue-600',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  let nextId = 0

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++nextId
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto max-w-sm rounded-lg px-4 py-3 text-sm text-white shadow-lg ${colors[t.type]}`}>
            <div className="flex items-center gap-2">
              {icons[t.type]}
              <span>{t.message}</span>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
