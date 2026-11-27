import { MODULES, getModule } from '../modules'
import { StatusTag, dueState } from '../ui'
import PendingPanel from '../components/PendingPanel'
import type { Attachment, Perm, Project, ProjectNode } from '../types'

export default function Dashboard({
  projects,
  nodes,
  attachments,
  perm,
  onOpen,
  onGoModule,
}: {
  projects: Project[]
  nodes: ProjectNode[]
  attachments: Attachment[]
  perm: Perm
  onOpen: (id: number, from: string) => void
  onGoModule: (k: string) => void
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const isOpen = (n: ProjectNode) => n.status !== '已通过' && n.status !== '已提交'
  const overdue = nodes.filter((n) => isOpen(n) && n.due_date && new Date(n.due_date + 'T00:00:00') < today)
  const soon = nodes.filter((n) => {
    if (!isOpen(n) || !n.due_date) return false
    const d = new Date(n.due_date + 'T00:00:00')
    const diff = (d.getTime() - today.getTime()) / 86400000
    return diff >= 0 && diff <= 30
  })

  const doneCount = projects.filter((p) => p.status === '已结题').length
  const fixing = projects.filter((p) => p.status === '需整改').length

  const projById = new Map(projects.map((p) => [p.id, p]))

  const todo = [...overdue, ...soon]
    .filter((n) => projById.has(n.project_id))
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
    .slice(0, 12)

  return (
    <>
      <PendingPanel perm={perm} projects={projects} onOpen={onOpen} />

      <div className="stat-grid">
        <div className="stat">
          <div className="k">项目总数</div>
          <div className="v">{projects.length}</div>
        </div>
        <div className="stat">
          <div className="k">节点材料总数</div>
          <div className="v">{attachments.length}</div>
        </div>
        <div className="stat">
          <div className="k">已结题</div>
          <div className="v">{doneCount}</div>
        </div>
        <div className="stat alert">
          <div className="k">需整改</div>
          <div className="v">{fixing}</div>
        </div>
        <div className="stat alert">
          <div className="k">逾期节点</div>
          <div className="v">{overdue.length}</div>
        </div>
        <div className="stat">
          <div className="k">30 天内到期</div>
          <div className="v">{soon.length}</div>
        </div>
      </div>

      <div className="card">
        <h3>各模块进度</h3>
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>模块</th>
                <th className="num">项目数</th>
                <th className="num">已结题</th>
                <th className="num">节点数</th>
                <th className="num">材料数</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {MODULES.map((mod) => {
                const k = mod.key
                const ps = projects.filter((p) => p.module_key === k)
                const ids = new Set(ps.map((p) => p.id))
                const ns = nodes.filter((n) => ids.has(n.project_id))
                const as = attachments.filter((a) => ids.has(a.project_id))
                return (
                  <tr key={k}>
                    <td>
                      {mod.icon} {mod.name}
                    </td>
                    <td className="num">{ps.length}</td>
                    <td className="num">{ps.filter((p) => p.status === '已结题').length}</td>
                    <td className="num">{ns.length}</td>
                    <td className="num">{as.length}</td>
                    <td className="nowrap">
                      <button className="btn ghost" onClick={() => onGoModule(k)}>
                        进入 →
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>近期待办（按节点应完成时间）</h3>
        {todo.length === 0 ? (
          <div className="empty">暂无临期或逾期节点。可在项目详情里为节点设置应完成时间。</div>
        ) : (
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>项目</th>
                  <th>节点</th>
                  <th>状态</th>
                  <th>应完成</th>
                  <th>提醒</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {todo.map((n) => {
                  const p = projById.get(n.project_id)!
                  const st = dueState(n.due_date, n.status)
                  const cls = st.level === 'over' ? 'danger' : st.level === 'soon' ? 'warn' : ''
                  return (
                    <tr key={n.id}>
                      <td>{p.name}</td>
                      <td>{n.name}</td>
                      <td>
                        <StatusTag status={n.status} />
                      </td>
                      <td className="nowrap">{n.due_date?.slice(0, 10) || '—'}</td>
                      <td>
                        <span className={`tag ${cls}`}>{st.level === 'over' ? '已逾期' : '临近'}</span>
                      </td>
                      <td className="nowrap">
                        <button className="btn ghost" onClick={() => onOpen(p.id, p.module_key)}>
                          查看
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
