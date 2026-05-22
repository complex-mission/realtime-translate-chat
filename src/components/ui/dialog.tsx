'use client'
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { IconAlertTriangle, IconInfo, IconXCircle, IconSpinner } from './icon'

// ─── Types ───
type DialogType = 'confirm' | 'prompt' | 'alert'

interface DialogOptions {
  type: DialogType
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  placeholder?: string
  defaultValue?: string
  inputType?: 'text' | 'password' | 'number'
  variant?: 'danger' | 'warning' | 'info' | 'default'
  loading?: boolean
}

interface DialogState extends DialogOptions {
  id: number
  resolve: (value: any) => void
}

// ─── Context ───
interface DialogContextType {
  confirm: (opts: { title: string; message?: string; confirmText?: string; cancelText?: string; variant?: 'danger' | 'warning' | 'default' }) => Promise<boolean>
  prompt: (opts: { title: string; message?: string; placeholder?: string; defaultValue?: string; inputType?: 'text' | 'password' | 'number'; confirmText?: string; cancelText?: string }) => Promise<string | null>
  alert: (opts: { title: string; message?: string; variant?: 'info' | 'warning' | 'danger' }) => Promise<void>
}

const DialogContext = createContext<DialogContextType>({
  confirm: () => Promise.resolve(false),
  prompt: () => Promise.resolve(null),
  alert: () => Promise.resolve(),
})

export function useDialog() { return useContext(DialogContext) }

// ─── Provider ───
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialogs, setDialogs] = useState<DialogState[]>([])
  const idRef = useRef(0)

  const confirm = useCallback((opts: { title: string; message?: string; confirmText?: string; cancelText?: string; variant?: 'danger' | 'warning' | 'default' }): Promise<boolean> => {
    return new Promise(resolve => {
      const id = ++idRef.current
      setDialogs(prev => [...prev, { id, type: 'confirm', ...opts, resolve }])
    })
  }, [])

  const prompt = useCallback((opts: { title: string; message?: string; placeholder?: string; defaultValue?: string; inputType?: 'text' | 'password' | 'number'; confirmText?: string; cancelText?: string }): Promise<string | null> => {
    return new Promise(resolve => {
      const id = ++idRef.current
      setDialogs(prev => [...prev, { id, type: 'prompt', ...opts, resolve }])
    })
  }, [])

  const alert = useCallback((opts: { title: string; message?: string; variant?: 'info' | 'warning' | 'danger' }): Promise<void> => {
    return new Promise(resolve => {
      const id = ++idRef.current
      setDialogs(prev => [...prev, { id, type: 'alert', ...opts, resolve }])
    })
  }, [])

  const handleClose = useCallback((id: number, value: any) => {
    setDialogs(prev => prev.filter(d => d.id !== id))
    const dialog = dialogs.find(d => d.id === id)
    dialog?.resolve(value)
  }, [dialogs])

  return (
    <DialogContext.Provider value={{ confirm, prompt, alert }}>
      {children}
      {dialogs.map(d => (
        <DialogItem key={d.id} dialog={d} onClose={handleClose} />
      ))}
    </DialogContext.Provider>
  )
}

// ─── Dialog Item ───
function DialogItem({ dialog, onClose }: { dialog: DialogState; onClose: (id: number, value: any) => void }) {
  const [inputValue, setInputValue] = useState(dialog.defaultValue || '')
  const [visible, setVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    if (dialog.type === 'prompt') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [dialog.type])

  const handleClose = (value: any) => {
    setVisible(false)
    setTimeout(() => onClose(dialog.id, value), 200)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (dialog.type === 'confirm') handleClose(true)
      else if (dialog.type === 'prompt') handleClose(inputValue)
      else handleClose(undefined)
    }
    if (e.key === 'Escape') {
      if (dialog.type === 'prompt') handleClose(null)
      else if (dialog.type === 'alert') handleClose(undefined)
      else handleClose(false)
    }
  }

  const variantColors = {
    danger: { icon: <IconXCircle size={24} className="text-red-500" />, btn: 'bg-red-600 hover:bg-red-700 focus:ring-red-500' },
    warning: { icon: <IconAlertTriangle size={24} className="text-yellow-500" />, btn: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500' },
    info: { icon: <IconInfo size={24} className="text-blue-500" />, btn: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' },
    default: { icon: null, btn: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' },
  }

  const variant = dialog.variant || 'default'
  const colors = variantColors[variant]

  const overlayClass = visible ? 'bg-black/50 backdrop-blur-sm' : 'bg-black/0'
  const panelClass = visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'

  return (
    <div
      className={'fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-200 ' + overlayClass}
      onClick={() => {
        if (dialog.type === 'prompt') handleClose(null)
        else if (dialog.type === 'alert') handleClose(undefined)
        else handleClose(false)
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        className={'w-full max-w-md rounded-xl bg-white shadow-2xl transition-all duration-200 ' + panelClass}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-4">
          {colors.icon && <div className="mt-0.5 shrink-0">{colors.icon}</div>}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900">{dialog.title}</h3>
            {dialog.message && <p className="mt-2 text-sm text-gray-500 leading-relaxed">{dialog.message}</p>}
          </div>
          <button
            onClick={() => {
              if (dialog.type === 'prompt') handleClose(null)
              else if (dialog.type === 'alert') handleClose(undefined)
              else handleClose(false)
            }}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <IconXCircle size={18} />
          </button>
        </div>

        {/* Input for prompt */}
        {dialog.type === 'prompt' && (
          <div className="px-6 pb-2">
            <input
              ref={inputRef}
              type={dialog.inputType || 'text'}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={dialog.placeholder || ''}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 pt-4">
          {(dialog.type === 'confirm' || dialog.type === 'prompt') && (
            <button
              onClick={() => handleClose(dialog.type === 'prompt' ? null : false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500/20 transition"
            >
              {dialog.cancelText || '取消'}
            </button>
          )}
          <button
            onClick={() => {
              if (dialog.type === 'confirm') handleClose(true)
              else if (dialog.type === 'prompt') handleClose(inputValue)
              else handleClose(undefined)
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition ${colors.btn}`}
          >
            {dialog.type === 'alert' ? (dialog.confirmText || '知道了') : (dialog.confirmText || '确定')}
          </button>
        </div>
      </div>
    </div>
  )
}
