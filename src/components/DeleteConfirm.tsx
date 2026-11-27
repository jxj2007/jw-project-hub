import { useState } from 'react'
import { Modal } from '../ui'

/**
 * 关键删除操作的强确认弹窗：
 * 1) 展示影响范围（将被一并删除的内容）
 * 2) 要求手动输入确认文本，避免误点
 * 3) 明确告知已自动备份、可从系统设置恢复
 */
export default function DeleteConfirm({
  title,
  target,
  impacts,
  requireText,
  onConfirm,
  onClose,
}: {
  title: string
  target: string
  impacts: { label: string; value: string | number }[]
  requireText?: string
  onConfirm: () => Promise<void> | void
  onClose: () => void
}) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const matched = !requireText || typed.trim() === requireText

  async function submit() {
    if (!matched) return
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={title}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="btn danger" onClick={submit} disabled={busy || !matched}>
            {busy ? '处理中…' : '确认删除'}
          </button>
        </>
      }
    >
      <div
        style={{
          background: '#fff4f2',
          border: '1px solid #f3c9c1',
          color: '#a83a2a',
          borderRadius: 6,
          padding: '10px 12px',
          fontSize: 13,
          lineHeight: 1.8,
        }}
      >
        即将删除：<b>{target}</b>
        <br />
        该操作不可撤销。删除前系统会自动生成快照，可在「系统设置 → 删除备份」中恢复。
      </div>

      {impacts.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="grid">
            <tbody>
              <tr>
                <td colSpan={2} style={{ background: '#fafbfd', color: '#475569', fontWeight: 600, fontSize: 13 }}>
                  将一并删除的内容
                </td>
              </tr>
              {impacts.map((it) => (
                <tr key={it.label}>
                  <td style={{ width: 150, background: '#fafbfd', color: '#475569' }}>{it.label}</td>
                  <td>{it.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {requireText && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>
            请输入 <b>{requireText}</b> 以确认：
          </div>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={requireText}
            autoFocus
          />
          {typed && !matched && (
            <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>输入不一致，无法删除</div>
          )}
        </div>
      )}
    </Modal>
  )
}
