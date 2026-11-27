import { useEffect, useState } from 'react'
import { cloud } from '../cloud'
import { fmtTime } from '../export'
import type { Perm, Project } from '../types'

type Row = {
  key: string
  kind: '节点' | '变更'
  title: string
  course: string
  applicant: string
  time: string
  projectId: number
}

/**
 * 待我审核：把分散在各门课里的待审事项汇总到工作台，
 * 避免审核人只能逐门课程翻找。
 */
export default function PendingPanel({
  perm,
  projects,
  onOpen,
}: {
  perm: Perm
  projects: Project[]
  onOpen: (id: number, from: string) => void
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [bookCount, setBookCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const canSee = perm.isAdmin || perm.canReview

  useEffect(() => {
    if (!canSee) {
      setLoading(false)
      return
    }
    let alive = true
    ;(async () => {
      try {
        const [nr, pc, tb] = await Promise.all([
          cloud.database.from('node_requests').select('*').eq('status', 'pending'),
          cloud.database.from('project_changes').select('*').eq('status', 'pending'),
          cloud.database.from('textbooks').select('*').eq('review_status', 'pending'),
        ])
        if (!alive) return

        const pmap = new Map(projects.map((p) => [p.id, p]))
        const nameOf = (pid: number) => pmap.get(pid)?.name || `课程 #${pid}`

        const out: Row[] = []
        for (const r of (nr.data || []) as any[]) {
          const pl = r.payload || {}
          out.push({
            key: `n-${r.id}`,
            kind: '节点',
            title: pl.conclusion ? String(pl.conclusion).slice(0, 30) : '节点内容待审',
            course: nameOf(r.project_id),
            applicant: r.applicant_name || '—',
            time: r.apply_time,
            projectId: r.project_id,
          })
        }
        for (const c of (pc.data || []) as any[]) {
          out.push({
            key: `c-${c.id}`,
            kind: '变更',
            title: c.title,
            course: nameOf(c.project_id),
            applicant: c.applicant_name || '—',
            time: c.apply_time,
            projectId: c.project_id,
          })
        }
        out.sort((a, b) => (a.time < b.time ? 1 : -1))
        setRows(out)
        setBookCount((tb.data || []).length)
      } catch {
        /* 忽略，保持空列表 */
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [canSee, projects])

  if (!canSee) return null

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>待我审核</h3>
        <div style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 13 }}>
          {loading ? '统计中…' : `节点/变更 ${rows.length} 项${bookCount ? ` · 教材 ${bookCount} 项` : ''}`}
        </span>
      </div>

      {loading ? (
        <div className="loading">加载中…</div>
      ) : rows.length === 0 && bookCount === 0 ? (
        <div className="empty">当前没有待审核事项。</div>
      ) : (
        <>
          {rows.length > 0 && (
            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>类型</th>
                    <th>课程</th>
                    <th>内容摘要</th>
                    <th style={{ width: 100 }}>申请人</th>
                    <th style={{ width: 150 }}>提交时间</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td>
                        <span className={`tag ${r.kind === '节点' ? 'info' : ''}`}>{r.kind}</span>
                      </td>
                      <td>{r.course}</td>
                      <td>{r.title}</td>
                      <td>{r.applicant}</td>
                      <td className="nowrap">{fmtTime(r.time)}</td>
                      <td>
                        <button className="btn sm primary" onClick={() => onOpen(r.projectId, 'three100')}>
                          去审核
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {bookCount > 0 && (
            <div className="muted" style={{ marginTop: 10 }}>
              另有 {bookCount} 本教材待审核，请到左侧「教材管理」处理。
            </div>
          )}
        </>
      )}
    </div>
  )
}
