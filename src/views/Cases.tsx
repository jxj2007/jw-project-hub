import { useEffect, useMemo, useState } from 'react'
import { createBackup, createCase, deleteCase, listCases, updateBackup, updateCase } from '../api'
import { fmtTime } from '../export'
import { CASE_TYPES } from '../types'
import type { CaseItem, Perm, Project } from '../types'
import { Field, Modal, toast } from '../ui'

export default function Cases({
  projects,
  perm,
  onOpenProject,
}: {
  projects: Project[]
  perm: Perm
  onOpenProject: (projectId: number) => void
}) {
  const [list, setList] = useState<CaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [kw, setKw] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [editing, setEditing] = useState<CaseItem | null>(null)
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<CaseItem | null>(null)

  async function load() {
    setLoading(true)
    try {
      setList(await listCases())
    } catch (e: any) {
      toast(e?.message || '案例数据加载失败', 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const projById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase()
    return list.filter((c) => {
      if (typeFilter && c.case_type !== typeFilter) return false
      if (!k) return true
      return [c.title, c.case_type, c.background, c.problem, c.approach, c.result, c.project_code]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(k))
    })
  }, [list, kw, typeFilter])

  async function remove(c: CaseItem) {
    if (!confirm(`确定删除案例「${c.title}」？\n删除前会自动备份记录，可在「系统设置 → 删除备份」查看。`)) return

    let bkId = 0
    try {
      const bk = await createBackup({
        table_name: 'cases',
        record_id: String(c.id),
        project_id: c.project_id,
        payload: { case: c },
        operator: perm.member?.name || '',
        status: 'pending',
        note: '删除案例前备份',
      })
      bkId = bk.id
    } catch {
      toast('备份失败，已中止删除', 'err')
      return
    }

    try {
      await deleteCase(c.id)
      await updateBackup(bkId, { status: 'deleted', note: '案例记录已删除' }).catch(() => {})
      toast('已删除，记录已备份')
      load()
    } catch (e: any) {
      await updateBackup(bkId, { status: 'failed', note: `删除失败：${e?.message || e}` }).catch(() => {})
      toast(e?.message || '删除失败', 'err')
    }
  }

  return (
    <>
      <div className="toolbar">
        <input
          type="text"
          placeholder="搜索案例名称 / 类型 / 内容 / 项目编号"
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          style={{ minWidth: 280 }}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">全部类型</option>
          {CASE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="spacer" />
        <button className="btn" onClick={load} disabled={loading}>
          刷新
        </button>
        {perm.canSubmit && (
          <button className="btn primary" onClick={() => setCreating(true)}>
            + 新增案例
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading">加载中…</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty">还没有案例。点右上角「新增案例」，按背景—问题—做法—结果四段录入。</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: 150 }}>项目编号</th>
                <th>案例名称</th>
                <th style={{ width: 120 }}>案例类型</th>
                <th>简要背景</th>
                <th style={{ width: 140 }}>关联课程</th>
                <th style={{ width: 150 }}>更新时间</th>
                <th style={{ width: 160 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const p = c.project_id ? projById.get(c.project_id) : null
                return (
                  <tr key={c.id}>
                    <td className="nowrap">
                      {c.project_code ? (
                        <button
                          className="btn ghost"
                          style={{ padding: 0 }}
                          onClick={() => c.project_id && onOpenProject(c.project_id)}
                          title="跳转到课程"
                        >
                          {c.project_code}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <button
                        className="btn ghost"
                        style={{ padding: 0, color: 'var(--brand)', fontWeight: 500 }}
                        onClick={() => setViewing(c)}
                      >
                        {c.title}
                      </button>
                    </td>
                    <td>{c.case_type ? <span className="tag info">{c.case_type}</span> : '—'}</td>
                    <td className="muted" style={{ maxWidth: 320 }}>
                      {c.background ? (
                        <span title={c.background}>{c.background.slice(0, 46)}{c.background.length > 46 ? '…' : ''}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="nowrap">{p?.name || '—'}</td>
                    <td className="nowrap">{fmtTime(c.updated_at)}</td>
                    <td className="nowrap">
                      <button className="btn sm" onClick={() => setViewing(c)}>
                        查看
                      </button>{' '}
                      {perm.canSubmit && (
                        <>
                          <button className="btn sm" onClick={() => setEditing(c)}>
                            编辑
                          </button>{' '}
                          <button className="btn sm danger" onClick={() => remove(c)}>
                            删除
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <CaseForm
          initial={editing}
          projects={projects}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onDone={load}
        />
      )}

      {viewing && (
        <CaseView
          item={viewing}
          projectName={viewing.project_id ? projById.get(viewing.project_id)?.name || '' : ''}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  )
}

/* --------------------------------- 案例表单 -------------------------------- */

function CaseForm({
  initial,
  projects,
  onClose,
  onDone,
}: {
  initial: CaseItem | null
  projects: Project[]
  onClose: () => void
  onDone: () => void
}) {
  const [f, setF] = useState<any>({
    title: initial?.title || '',
    case_type: initial?.case_type || '',
    project_id: initial?.project_id ?? '',
    project_code: initial?.project_code || '',
    background: initial?.background || '',
    problem: initial?.problem || '',
    approach: initial?.approach || '',
    result: initial?.result || '',
    remark: initial?.remark || '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }))

  function pickProject(idStr: string) {
    const p = projects.find((x) => String(x.id) === idStr)
    set('project_id', idStr)
    set('project_code', p?.code || '')
  }

  async function save() {
    setErr('')
    if (!f.title.trim()) return setErr('请填写案例名称')
    if (!f.case_type) return setErr('请选择案例类型')

    setBusy(true)
    try {
      const payload: any = {
        title: f.title.trim(),
        case_type: f.case_type,
        project_id: f.project_id ? Number(f.project_id) : null,
        project_code: f.project_code || null,
        background: f.background || null,
        problem: f.problem || null,
        approach: f.approach || null,
        result: f.result || null,
        remark: f.remark || null,
      }
      if (initial) await updateCase(initial.id, payload)
      else await createCase(payload)
      toast(initial ? '已保存' : '已新增案例')
      onDone()
      onClose()
    } catch (e: any) {
      setErr(e?.message || '保存失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={initial ? '编辑案例' : '新增案例'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? '保存中…' : '保存'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="案例名称" required full>
          <input value={f.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="案例类型" required>
          <select value={f.case_type} onChange={(e) => set('case_type', e.target.value)}>
            <option value="">请选择</option>
            {CASE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="关联课程（选填）">
          <select value={String(f.project_id)} onChange={(e) => pickProject(e.target.value)}>
            <option value="">不关联</option>
            {projects.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.code ? `${p.code} · ` : ''}
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="简要背景" full>
          <textarea
            value={f.background}
            onChange={(e) => set('background', e.target.value)}
            placeholder="课程/专业/企业背景，为什么要做这个案例"
          />
        </Field>
        <Field label="要解决的问题" full>
          <textarea
            value={f.problem}
            onChange={(e) => set('problem', e.target.value)}
            placeholder="教学中遇到的具体问题"
          />
        </Field>
        <Field label="具体做法" full>
          <textarea
            value={f.approach}
            onChange={(e) => set('approach', e.target.value)}
            placeholder="怎么做，分步骤写清楚"
            style={{ minHeight: 100 }}
          />
        </Field>
        <Field label="结果与成效" full>
          <textarea
            value={f.result}
            onChange={(e) => set('result', e.target.value)}
            placeholder="取得了什么效果，尽量带数据"
          />
        </Field>
        <Field label="备注" full>
          <input value={f.remark} onChange={(e) => set('remark', e.target.value)} />
        </Field>
      </div>

      {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{err}</div>}
    </Modal>
  )
}

/* --------------------------------- 案例查看 -------------------------------- */

function CaseView({
  item,
  projectName,
  onClose,
}: {
  item: CaseItem
  projectName: string
  onClose: () => void
}) {
  const sections: [string, string | null][] = [
    ['简要背景', item.background],
    ['要解决的问题', item.problem],
    ['具体做法', item.approach],
    ['结果与成效', item.result],
  ]

  return (
    <Modal
      title={`案例 · ${item.case_type || '未分类'}`}
      onClose={onClose}
      footer={
        <button className="btn" onClick={onClose}>
          关闭
        </button>
      }
    >
      <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>{item.title}</h3>
      <div className="muted" style={{ marginBottom: 16 }}>
        类别：{item.case_type || '—'}
        {item.project_code ? ` ｜ 项目编号：${item.project_code}` : ''}
        {projectName ? ` ｜ 关联课程：${projectName}` : ''}
      </div>

      {sections.map(([label, text]) => (
        <div key={label} style={{ marginBottom: 16 }}>
          <div
            style={{
              fontWeight: 600,
              color: 'var(--brand)',
              borderLeft: '3px solid var(--brand)',
              paddingLeft: 8,
              marginBottom: 6,
            }}
          >
            {label}
          </div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#334155' }}>
            {text || <span className="muted">未填写</span>}
          </div>
        </div>
      ))}

      {item.remark && (
        <div className="muted" style={{ marginTop: 8 }}>
          备注：{item.remark}
        </div>
      )}
    </Modal>
  )
}
