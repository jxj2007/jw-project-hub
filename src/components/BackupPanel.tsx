import { useEffect, useState } from 'react'
import { listBackups, restoreProjectFromBackup } from '../api'
import { fmtTime } from '../export'
import type { DeletionBackup } from '../types'
import { toast } from '../ui'

const TABLE_LABEL: Record<string, string> = {
  projects: '课程',
  project_attachments: '附件',
  textbooks: '教材',
  cases: '案例',
  members: '成员',
}

const STATUS_LABEL: Record<string, string> = {
  pending: '处理中',
  deleted: '已删除',
  failed: '失败',
  restored: '已恢复',
  ok: '已备份',
}

export default function BackupPanel() {
  const [list, setList] = useState<DeletionBackup[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(0)

  async function load() {
    setLoading(true)
    try {
      setList(await listBackups(100))
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function restore(bk: DeletionBackup) {
    if (!confirm('确定按该备份恢复这门课程？将新建一条课程记录，备份本身保留以便追溯。')) return
    setBusyId(bk.id)
    try {
      const r = await restoreProjectFromBackup(bk)
      toast(r.message, r.ok ? undefined : 'err')
      if (r.ok) load()
    } catch (e: any) {
      toast(e?.message || '恢复失败', 'err')
    } finally {
      setBusyId(0)
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>删除备份</h3>
        <div style={{ flex: 1 }} />
        <button className="btn sm" onClick={load} disabled={loading}>
          刷新
        </button>
      </div>

      <p className="muted" style={{ marginTop: 0, fontSize: 13, lineHeight: 1.8 }}>
        所有删除操作在动手前都会写入快照。课程可从下方「恢复」重建（附件原始文件不在备份内，需重新上传）；教材、案例、成员保留记录快照供核对。
      </p>

      {loading ? (
        <div className="loading">加载中…</div>
      ) : list.length === 0 ? (
        <div className="empty">暂无删除备份记录</div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: 70 }}>编号</th>
                <th style={{ width: 90 }}>对象</th>
                <th>内容</th>
                <th style={{ width: 90 }}>状态</th>
                <th style={{ width: 150 }}>时间</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {list.map((bk) => {
                const name =
                  bk.payload?.project?.name ||
                  bk.payload?.textbook?.name ||
                  bk.payload?.case?.title ||
                  bk.payload?.member?.name ||
                  bk.payload?.attachment?.file_name ||
                  bk.record_id ||
                  '—'
                const cls =
                  bk.status === 'deleted'
                    ? 'ok'
                    : bk.status === 'failed'
                      ? 'danger'
                      : bk.status === 'restored'
                        ? 'info'
                        : ''
                return (
                  <tr key={bk.id}>
                    <td className="muted">{bk.id}</td>
                    <td>{TABLE_LABEL[bk.table_name] || bk.table_name}</td>
                    <td>
                      {name}
                      {bk.note && <div className="muted">{bk.note}</div>}
                    </td>
                    <td>
                      <span className={`tag ${cls}`}>{STATUS_LABEL[bk.status] || bk.status}</span>
                    </td>
                    <td className="nowrap">{fmtTime(bk.created_at)}</td>
                    <td>
                      {bk.table_name === 'projects' && bk.status === 'deleted' && (
                        <button className="btn sm" disabled={busyId === bk.id} onClick={() => restore(bk)}>
                          {busyId === bk.id ? '恢复中…' : '恢复'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
