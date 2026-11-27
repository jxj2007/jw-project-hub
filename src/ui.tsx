import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

/* --------------------------------- Toast --------------------------------- */

type ToastItem = { id: number; msg: string; type: string }
let seq = 1
let push: ((msg: string, type: string) => void) | null = null

export function toast(msg: string, type: 'ok' | 'err' | 'info' = 'ok') {
  if (push) push(msg, type)
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => {
    push = (msg, type) => {
      const id = seq++
      setItems((prev) => [...prev, { id, msg, type }])
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3200)
    }
    return () => {
      push = null
    }
  }, [])
  return (
    <div className="toast-wrap">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.type === 'err' ? 'err' : t.type === 'ok' ? 'ok' : ''}`}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

/* --------------------------------- Modal --------------------------------- */

export function Modal({
  title,
  children,
  onClose,
  footer,
  size,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
  size?: 'sm' | 'lg'
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="mask" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size === 'sm' ? 'sm' : ''}${size === 'lg' ? ' lg' : ''}`}>
        <div className="modal-head">
          {title}
          <button className="x" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

/* --------------------------------- Field --------------------------------- */

export function Field({
  label,
  required,
  children,
  full,
}: {
  label: string
  required?: boolean
  children: ReactNode
  full?: boolean
}) {
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      <label>
        {label}
        {required && <span className="req">*</span>}
      </label>
      {children}
    </div>
  )
}

/* --------------------------------- 状态标签 --------------------------------- */

export function StatusTag({ status }: { status?: string | null }) {
  const s = status || '未开始'
  const cls =
    s === '已通过' || s === '已结题'
      ? 'ok'
      : s === '需整改'
        ? 'danger'
        : s === '已提交' || s === '进行中'
          ? 'info'
          : s === '未开始'
            ? ''
            : 'warn'
  return <span className={`tag ${cls}`}>{s}</span>
}

export function dueState(due?: string | null, status?: string | null) {
  if (!due) return { level: 'none' as const, text: '未设截止', days: null as number | null }
  if (status === '已通过' || status === '已提交') {
    return { level: 'done' as const, text: due.slice(0, 10), days: null }
  }
  const d = new Date(due + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (days < 0) return { level: 'over' as const, text: `逾期 ${-days} 天`, days }
  if (days <= 30) return { level: 'soon' as const, text: `剩 ${days} 天`, days }
  return { level: 'ok' as const, text: due.slice(0, 10), days }
}
