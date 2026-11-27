import { useMemo, useState } from 'react'
import { getModule } from '../modules'
import { downloadCsv } from '../export'
import { StatusTag } from '../ui'
import { MiniProgress } from '../components/Progress'
import type { Attachment, Perm, Project, ProjectNode } from '../types'
import ProjectForm from '../components/ProjectForm'
import ImportModal from '../components/ImportModal'

export default function ProjectList({
  moduleKey,
  projects,
  nodes,
  attachments,
  perm,
  onOpen,
  onReload,
}: {
  moduleKey: string
  projects: Project[]
  nodes: ProjectNode[]
  attachments: Attachment[]
  perm: Perm
  onOpen: (id: number) => void
  onReload: () => void
}) {
  const mod = getModule(moduleKey)
  const listFields = mod.fields.filter((f) => f.showInList)
  const [kw, setKw] = useState('')
  const [dept, setDept] = useState('')
  const [status, setStatus] = useState('')
  const [year, setYear] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const mine = useMemo(() => projects.filter((p) => p.module_key === moduleKey), [projects, moduleKey])

  const depts = useMemo(() => Array.from(new Set(mine.map((p) => p.dept).filter(Boolean))) as string[], [mine])
  const years = useMemo(
    () => Array.from(new Set(mine.map((p) => p.year).filter((y) => y !== null))).sort() as number[],
    [mine],
  )

  const list = useMemo(() => {
    const k = kw.trim().toLowerCase()
    return mine.filter((p) => {
      if (dept && p.dept !== dept) return false
      if (status && p.status !== status) return false
      if (year && String(p.year) !== year) return false
      if (!k) return true
      return [p.name, p.leader, p.dept, p.code, p.category, p.members]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(k))
    })
  }, [mine, kw, dept, status, year])

  const nodeOf = (pid: number) => nodes.filter((n) => n.project_id === pid)
  const attOf = (pid: number) => attachments.filter((a) => a.project_id === pid)

  function exportList() {
    const head = [
      '序号',
      '项目编号',
      mod.nameLabel,
      mod.leaderLabel,
      '所属院部',
      ...listFields.map((f) => f.label),
      '类别',
      '级别',
      '立项年度',
      '建设周期',
      '经费(万元)',
      '状态',
      '节点进度',
      '材料数',
      '备注',
    ]
    const rows = list.map((p, i) => {
      const ns = nodeOf(p.id)
      const done = ns.filter((n) => n.status === '已通过').length
      return [
        i + 1,
        p.code || '',
        p.name,
        p.leader,
        p.dept,
        ...listFields.map((f) => ((p.extra || {}) as any)[f.key] || ''),
        p.category,
        p.level,
        p.year,
        [p.start_month, p.end_month].filter(Boolean).join(' ~ '),
        p.funding,
        p.status,
        `${done}/${ns.length}`,
        attOf(p.id).length,
        p.remark,
      ]
    })
    downloadCsv(`${mod.name}_${new Date().toISOString().slice(0, 10)}.csv`, [head, ...rows])
  }

  return (
    <>
      <div className="toolbar">
        <input
          type="text"
          placeholder={`搜索${mod.nameLabel} / ${mod.leaderLabel} / 院部`}
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          style={{ minWidth: 240 }}
        />
        <select value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">全部院部</option>
          {depts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全部状态</option>
          {['未开始', '进行中', '已提交', '已通过', '需整改', '已结题'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">全部年度</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
        <div className="spacer" />
        <button className="btn" onClick={exportList}>
          导出表格
        </button>
        {(perm.isAdmin || perm.canReview) && (
          <>
            <button className="btn" onClick={() => setShowImport(true)}>
              批量导入
            </button>
            <button className="btn primary" onClick={() => setShowForm(true)}>
              + 新增{mod.itemLabel}
            </button>
          </>
        )}
      </div>

      <div className="muted" style={{ marginBottom: 10 }}>
        共 {list.length} 条{list.length !== mine.length ? `（全部 ${mine.length} 条）` : ''}
      </div>

      {list.length === 0 ? (
        <div className="card">
          <div className="empty">
            {perm.isAdmin || perm.canReview
              ? `还没有${mod.itemLabel}。点击右上角「新增${mod.itemLabel}」开始录入。`
              : `你的账号名下暂时没有${mod.itemLabel}。系统只显示由你主持的${mod.itemLabel}，如需填报请联系管理员指派。`}
          </div>
        </div>
      ) : (
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 230px)' }}>
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th style={{ width: 150 }}>项目编号</th>
                <th>{mod.nameLabel}</th>
                <th>{mod.leaderLabel}</th>
                <th>院部</th>
                {listFields.map((f) => (
                  <th key={f.key}>{f.label}</th>
                ))}
                <th>级别</th>
                <th>年度</th>
                <th>节点进度</th>
                <th>状态</th>
                <th className="num">材料</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((p, i) => {
                const ns = nodeOf(p.id)
                const done = ns.filter((n) => n.status === '已通过').length
                const bad = ns.filter((n) => n.status === '需整改').length
                return (
                  <tr key={p.id}>
                    <td className="muted">{i + 1}</td>
                    <td className="nowrap">{p.code || '—'}</td>
                    <td>
                      <button className="btn ghost" style={{ padding: 0, color: 'var(--brand)', fontWeight: 500 }} onClick={() => onOpen(p.id)}>
                        {p.name}
                      </button>
                    </td>
                    <td className="nowrap">{p.leader || '—'}</td>
                    <td className="nowrap">{p.dept || '—'}</td>
                    {listFields.map((f) => (
                      <td key={f.key} className="nowrap">
                        {((p.extra || {}) as any)[f.key] || '—'}
                      </td>
                    ))}
                    <td className="nowrap">{p.level || '—'}</td>
                    <td className="nowrap">{p.year || '—'}</td>
                    <td style={{ minWidth: 130 }}>
                      <MiniProgress nodes={ns} />
                      {bad > 0 && (
                        <div className="muted" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>
                          待整改 {bad} 项
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusTag status={p.status} />
                    </td>
                    <td className="num">{attOf(p.id).length}</td>
                    <td className="nowrap">
                      <button className="btn ghost" onClick={() => onOpen(p.id)}>
                        详情
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showImport && (
        <ImportModal
          moduleKey={moduleKey}
          onClose={() => setShowImport(false)}
          onDone={() => onReload()}
        />
      )}

      {showForm && (
        <ProjectForm
          moduleKey={moduleKey}
          onClose={() => setShowForm(false)}
          onDone={() => {
            onReload()
          }}
        />
      )}
    </>
  )
}
