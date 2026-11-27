import { useEffect, useRef, useState } from 'react'
import {
  addLog,
  createBackup,
  createNodeRequest,
  createProjectChange,
  deleteAttachment,
  deleteProject,
  downloadAttachment,
  listLogs,
  listNodeRequests,
  listProjectChanges,
  pathHasCJK,
  relocateAttachment,
  updateBackup,
  updateNode,
  updateNodeRequest,
  updateProjectChange,
  uploadAttachment,
} from '../api'
import { getModule } from '../modules'
import { fmtSize, fmtTime } from '../export'
import { Field, Modal, StatusTag, toast } from '../ui'
import type { Attachment, NodeRequest, Perm, Project, ProjectChange, ProjectNode } from '../types'
import ProjectForm from '../components/ProjectForm'
import DeleteConfirm from '../components/DeleteConfirm'
import AttachmentPreview from '../components/AttachmentPreview'
import { ProgressPanel } from '../components/Progress'
import ErrorBoundary from '../ErrorBoundary'
import { cloud } from '../cloud'

const NODE_STATUS = ['未开始', '进行中', '已提交', '已通过', '需整改']

export default function ProjectDetail({
  projectId,
  projects,
  nodes,
  attachments,
  perm,
  onReload,
  onBack,
}: {
  projectId: number
  projects: Project[]
  nodes: ProjectNode[]
  attachments: Attachment[]
  perm: Perm
  onReload: () => void
  onBack: () => void
}) {
  const project = projects.find((p) => p.id === projectId)
  const [tab, setTab] = useState<string>('info')
  const [editing, setEditing] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  if (!project) {
    return (
      <div className="card">
        <div className="empty">该项目不存在或已被删除。</div>
        <div style={{ textAlign: 'center' }}>
          <button className="btn" onClick={onBack}>
            返回列表
          </button>
        </div>
      </div>
    )
  }

  const mod = getModule(project.module_key)
  const myNodes = nodes
    .filter((n) => n.project_id === project.id)
    .sort((a, b) => a.sort_order - b.sort_order)
  const totalFiles = attachments.filter((a) => a.project_id === project.id).length

  async function doRemoveProject() {
    if (!project) return
    const pj = project
    const childNodes = nodes.filter((n) => n.project_id === pj.id)
    const childFiles = attachments.filter((a) => a.project_id === pj.id)

    // 1) 先备份；备份失败即中止，保证数据不丢
    let bkId = 0
    try {
      const bk = await createBackup({
        table_name: 'projects',
        record_id: String(pj.id),
        project_id: pj.id,
        payload: { project: pj, nodes: childNodes, attachments: childFiles },
        operator: perm.member?.name || '',
        status: 'pending',
        note: '删除前自动备份',
      })
      bkId = bk.id
    } catch (e: any) {
      toast('备份失败，已中止删除以保护数据', 'err')
      return
    }

    // 2) 执行删除
    try {
      await deleteProject(pj.id)
    } catch (e: any) {
      await updateBackup(bkId, {
        status: 'failed',
        note: `删除调用失败：${e?.message || e}`,
      }).catch(() => {})
      toast(`删除失败：${e?.message || ''}。数据未变动，备份已保留`, 'err')
      return
    }

    // 3) 删除结果核对
    let gone = false
    try {
      const { data } = await cloud.database.from('projects').select('id').eq('id', pj.id)
      gone = !data || data.length === 0
    } catch {
      gone = false
    }

    await updateBackup(bkId, {
      status: gone ? 'deleted' : 'failed',
      note: gone ? '删除成功并已核对' : '删除后仍可查询到记录，请重试或联系管理员',
    }).catch(() => {})

    if (!gone) {
      toast('删除结果异常：记录仍然存在，已保留备份供核对', 'err')
      return
    }

    try {
      await addLog(pj.id, '删除课程', `${pj.name}（备份编号 ${bkId}）`)
    } catch {
      /* 日志失败不影响主流程 */
    }
    toast('已删除，可在「系统设置 → 删除备份」中恢复')
    setShowDelete(false)
    onReload()
    onBack()
  }

  return (
    <>
      <div className="detail-head">
        <h3 className="title">{project.name}</h3>
        <div className="meta">
          <span>
            {mod.leaderLabel}：<b>{project.leader || '—'}</b>
          </span>
          <span>
            院部：<b>{project.dept || '—'}</b>
          </span>
          {(perm.isAdmin || perm.canReview) && (
            <span>
              填报人：
              <b>
                {project.contributor_id
                  ? perm.members?.find((m) => m.id === project.contributor_id)?.name || '已指定'
                  : '未指定'}
              </b>
            </span>
          )}
          {mod.key === 'three100' && (
            <span>
              课程性质：<b>{(project.extra as any)?.course_nature || '—'}</b>
            </span>
          )}
          <span>
            级别：<b>{project.level || '—'}</b>
          </span>
          <span>
            年度：<b>{project.year || '—'}</b>
          </span>
          <span>
            状态：<StatusTag status={project.status} />
          </span>
          <span>
            材料：<b>{totalFiles}</b> 份
          </span>
          <span style={{ marginLeft: 'auto' }}>
            {(perm.isAdmin || perm.canReview) && (
              <button className="btn sm" onClick={() => setEditing(true)}>
                编辑基本信息
              </button>
            )}
          </span>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'info' ? 'on' : ''} onClick={() => setTab('info')}>
          基本信息
        </button>
        {myNodes.map((n) => (
          <button key={n.id} className={tab === String(n.id) ? 'on' : ''} onClick={() => setTab(String(n.id))}>
            {n.name}
            <span
              className={`tag ${n.status === '已通过' ? 'ok' : n.status === '需整改' ? 'danger' : n.status === '已提交' ? 'info' : ''}`}
              style={{ marginLeft: 6 }}
            >
              {n.status}
            </span>
          </button>
        ))}
        <button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>
          变更记录
        </button>
      </div>

      <ProgressPanel nodes={myNodes} />

      <ErrorBoundary key={tab}>
      {tab === 'info' && (
        <InfoPanel
          project={project}
          canDelete={perm.isAdmin}
          onRemove={() => setShowDelete(true)}
        />
      )}
      {tab === 'log' && <ChangePanel project={project} perm={perm} />}
      {myNodes.map((n) =>
        tab === String(n.id) ? (
          <NodePanel
            key={n.id}
            project={project}
            node={n}
            files={attachments.filter((a) => a.node_id === n.id)}
            perm={perm}
            onReload={onReload}
          />
        ) : null,
      )}
      </ErrorBoundary>

      {editing && (
        <ProjectForm
          moduleKey={project.module_key}
          initial={project}
          onClose={() => setEditing(false)}
          onDone={onReload}
        />
      )}

      {showDelete && (
        <DeleteConfirm
          title="删除课程"
          target={project.name}
          requireText={project.name}
          impacts={[
            {
              label: '课程节点',
              value: `${nodes.filter((n) => n.project_id === project.id).length} 个`,
            },
            {
              label: '附件记录',
              value: `${attachments.filter((a) => a.project_id === project.id).length} 份`,
            },
          ]}
          onConfirm={doRemoveProject}
          onClose={() => setShowDelete(false)}
        />
      )}
    </>
  )
}

/* -------------------------------- 基本信息 -------------------------------- */

function InfoPanel({
  project,
  canDelete,
  onRemove,
}: {
  project: Project
  canDelete: boolean
  onRemove: () => void
}) {
  const mod = getModule(project.module_key)
  const extra = (project.extra || {}) as Record<string, any>

  const rows: [string, any][] = [
    [mod.nameLabel, project.name],
    ['项目编号', project.code],
    [mod.leaderLabel, project.leader],
    ['所属院部', project.dept],
    ['团队成员', project.members],
    ['联系电话', project.phone],
    ['类别', project.category],
    ['级别', project.level],
    ['立项年度', project.year],
    ['建设周期', [project.start_month, project.end_month].filter(Boolean).join(' ~ ')],
    ['经费（万元）', project.funding],
    ['当前阶段', project.stage],
    ['状态', project.status],
    ...mod.fields.map((f) => [f.label, extra[f.key]] as [string, any]),
    ['备注', project.remark],
  ]

  return (
    <>
      <div className="card">
        <h3>基本信息</h3>
        <div className="table-wrap">
          <table className="grid">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td style={{ width: 180, background: '#fafbfd', color: '#475569' }}>{k}</td>
                  <td>{v === null || v === undefined || v === '' ? '—' : String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {canDelete && (
        <div className="card">
          <h3>危险操作</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            删除后，该{mod.itemLabel}的全部节点与附件记录都会消失，且无法恢复。
          </p>
          <button className="btn danger" onClick={onRemove}>
            删除此{mod.itemLabel}
          </button>
        </div>
      )}
    </>
  )
}

/* -------------------------------- 变更记录 -------------------------------- */

/* -------------------------------- 变更记录（填报申请 + 审核） -------------------------------- */

function ChangeTag({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    pending: ['待审核', 'info'],
    approved: ['已通过', 'ok'],
    rejected: ['已驳回', 'danger'],
  }
  const [txt, cls] = map[status] || ['—', '']
  return <span className={`tag ${cls}`}>{txt}</span>
}

function ChangePanel({ project, perm }: { project: Project; perm: Perm }) {
  const [list, setList] = useState<ProjectChange[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [reviewing, setReviewing] = useState<ProjectChange | null>(null)
  const canFill = perm.canSubmit || perm.canReview || project.contributor_id === perm.member?.id

  async function load() {
    setLoading(true)
    try {
      setList(await listProjectChanges(project.id))
    } catch (e: any) {
      toast(e?.message || '变更记录加载失败', 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  return (
    <>
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>变更记录（{list.length} 条）</h3>
          <div style={{ flex: 1 }} />
          {canFill && (
            <button className="btn sm primary" onClick={() => setAdding(true)}>
              + 新增变更
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading">加载中…</div>
        ) : list.length === 0 ? (
          <div className="empty">
            暂无变更申请。填报人可新增变更事项，提交后由审核人审核，通过后方记录为已通过。
          </div>
        ) : (
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th style={{ width: 170 }}>变更事项</th>
                  <th>变更说明</th>
                  <th style={{ width: 150 }}>申请人 / 时间</th>
                  <th style={{ width: 90 }}>状态</th>
                  <th style={{ width: 150 }}>审核人 / 时间</th>
                  <th style={{ width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td>{c.title}</td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{c.content || '—'}</td>
                    <td className="nowrap">
                      {c.applicant_name || '—'}
                      <div className="muted">{fmtTime(c.apply_time)}</div>
                    </td>
                    <td>
                      <ChangeTag status={c.status} />
                      {c.status === 'rejected' && c.problems && (
                        <div className="muted" style={{ marginTop: 4 }}>
                          {c.problems}
                        </div>
                      )}
                    </td>
                    <td className="nowrap">
                      {c.reviewer_name || '—'}
                      {c.review_time && <div className="muted">{fmtTime(c.review_time)}</div>}
                    </td>
                    <td>
                      {perm.canReview && c.status === 'pending' && (
                        <button className="btn sm primary" onClick={() => setReviewing(c)}>
                          审核
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LogPanel projectId={project.id} />

      {adding && (
        <ChangeForm
          projectId={project.id}
          applicant={perm.member?.name || ''}
          onClose={() => setAdding(false)}
          onDone={load}
        />
      )}
      {reviewing && (
        <ChangeReview
          item={reviewing}
          reviewer={perm.member?.name || ''}
          onClose={() => setReviewing(null)}
          onDone={load}
        />
      )}
    </>
  )
}

function ChangeForm({
  projectId,
  applicant,
  onClose,
  onDone,
}: {
  projectId: number
  applicant: string
  onClose: () => void
  onDone: () => void
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!title.trim()) {
      setErr('请填写变更事项')
      return
    }
    setBusy(true)
    setErr('')
    try {
      await createProjectChange({
        project_id: projectId,
        title: title.trim(),
        content: content.trim() || null,
        status: 'pending',
        applicant_name: applicant || null,
      })
      toast('变更申请已提交，等待审核')
      onDone()
      onClose()
    } catch (e: any) {
      setErr(e?.message || '提交失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="新增变更申请"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? '提交中…' : '提交审核'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="变更事项" required full>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="如：课程负责人变更、建设进度调整、教材出版计划变更"
          />
        </Field>
        <Field label="变更说明" full>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="说明变更内容、原因及影响"
          />
        </Field>
      </div>
      {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{err}</div>}
    </Modal>
  )
}

function ChangeReview({
  item,
  reviewer,
  onClose,
  onDone,
}: {
  item: ProjectChange
  reviewer: string
  onClose: () => void
  onDone: () => void
}) {
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  async function decide(pass: boolean) {
    if (!pass && !comment.trim()) {
      toast('驳回时请填写原因', 'err')
      return
    }
    setBusy(true)
    try {
      await updateProjectChange(item.id, {
        status: pass ? 'approved' : 'rejected',
        result: pass ? '通过' : '不通过',
        reviewer_name: reviewer || null,
        review_time: new Date().toISOString(),
        problems: pass ? null : comment.trim(),
      })
      toast(pass ? '已通过' : '已驳回')
      onDone()
      onClose()
    } catch (e: any) {
      toast(e?.message || '操作失败', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="审核变更申请"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button className="btn danger" onClick={() => decide(false)} disabled={busy}>
            驳回
          </button>
          <button className="btn primary" onClick={() => decide(true)} disabled={busy}>
            通过
          </button>
        </>
      }
    >
      <div className="table-wrap" style={{ marginBottom: 14 }}>
        <table className="grid">
          <tbody>
            <tr>
              <td style={{ width: 90, background: '#fafbfd', color: '#475569' }}>变更事项</td>
              <td>{item.title}</td>
            </tr>
            <tr>
              <td style={{ background: '#fafbfd', color: '#475569' }}>变更说明</td>
              <td style={{ whiteSpace: 'pre-wrap' }}>{item.content || '—'}</td>
            </tr>
            <tr>
              <td style={{ background: '#fafbfd', color: '#475569' }}>申请人</td>
              <td>
                {item.applicant_name || '—'} · {fmtTime(item.apply_time)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <Field label="驳回原因（驳回时必填）" full>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
    </Modal>
  )
}

/* -------------------------------- 系统操作日志 -------------------------------- */

function LogPanel({ projectId }: { projectId: number }) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listLogs(projectId)
      .then(setLogs)
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading) return <div className="loading">加载中…</div>
  if (!logs.length) return <div className="card"><div className="empty">暂无变更记录。</div></div>

  return (
    <div className="card">
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th style={{ width: 180 }}>时间</th>
              <th style={{ width: 220 }}>操作</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="nowrap">{fmtTime(l.created_at)}</td>
                <td>{l.action}</td>
                <td>{l.detail || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* --------------------------------- 节点面板 -------------------------------- */

function NodePanel({
  project,
  node,
  files,
  perm,
  onReload,
}: {
  project: Project
  node: ProjectNode
  files: Attachment[]
  perm: Perm
  onReload: () => void
}) {
  const [f, setF] = useState<any>({ ...node })
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [over, setOver] = useState(false)
  const [reviewProblems, setReviewProblems] = useState('')
  const [reviewRequirements, setReviewRequirements] = useState('')
  const [reviewScore, setReviewScore] = useState('')
  const [preview, setPreview] = useState<Attachment | null>(null)
  const [reqs, setReqs] = useState<NodeRequest[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const latest = reqs[0] || null
  const pending = reqs.find((r) => r.status === 'pending') || null
  const locked = node.status === '已提交' || node.status === '已通过'
  /** 填报权限：具备填报权、审核权，或本人就是这门课的负责人 */
  const isContributor = project.contributor_id === perm.member?.id
  const canFill = perm.canSubmit || perm.canReview || isContributor

  useEffect(() => {
    let alive = true
    listNodeRequests(node.id)
      .then((rs) => {
        if (alive) setReqs(rs)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [node.id, node.status])

  useEffect(() => {
    if (pending) {
      setF({
        ...node,
        conclusion: pending.payload?.conclusion ?? '',
        submit_date: pending.payload?.submit_date ?? '',
        due_date: pending.payload?.due_date ?? '',
        remark: pending.payload?.remark ?? '',
      })
    } else if (latest && latest.status === 'rejected') {
      setF({
        ...node,
        conclusion: latest.payload?.conclusion ?? node.conclusion,
        submit_date: latest.payload?.submit_date ?? node.submit_date,
        due_date: latest.payload?.due_date ?? node.due_date,
        remark: latest.payload?.remark ?? node.remark,
      })
    } else {
      setF({ ...node })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, node.status, latest?.id])

  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }))

  const todayStr = () => new Date().toISOString().slice(0, 10)

  async function submitApply() {
    if (!String(f.conclusion || '').trim()) {
      toast('请先填写本节点情况', 'err')
      return
    }
    if (files.length === 0) {
      if (!confirm('该节点还没有上传任何附件，仍要提交申请吗？')) return
    }
    setBusy(true)
    try {
      const payload = {
        conclusion: f.conclusion || null,
        submit_date: f.submit_date || todayStr(),
        due_date: f.due_date || null,
        remark: f.remark || null,
      }
      const applicant = perm.member?.name || ''
      if (pending) {
        await updateNodeRequest(pending.id, {
          payload,
          apply_time: new Date().toISOString(),
          applicant_name: applicant,
        })
      } else {
        await createNodeRequest({
          project_id: project.id,
          node_id: node.id,
          payload,
          status: 'pending',
          applicant_name: applicant,
        })
      }
      await updateNode(node.id, {
        status: '已提交',
        submitter_name: applicant,
        reviewer_name: null,
        review_comment: null,
      })
      addLog(project.id, `提交变更申请「${node.name}」`, applicant)
      toast('申请已提交，审核通过后生效')
      onReload()
    } catch (e: any) {
      toast(e?.message || '提交失败', 'err')
    } finally {
      setBusy(false)
    }
  }

  /** 撤回申请：状态回到可编辑，撤销待审核的申请单 */
  async function withdraw() {
    if (!pending) {
      toast('没有可撤回的申请', 'err')
      return
    }
    if (!confirm('确定撤回本次申请？撤回后可重新修改并提交。')) return
    setBusy(true)
    try {
      await updateNodeRequest(pending.id, {
        status: 'withdrawn',
        result: '已撤回',
        reviewer_name: perm.member?.name || '',
        review_time: new Date().toISOString(),
      })
      await updateNode(node.id, { status: '进行中' })
      try {
        await addLog(project.id, `撤回申请「${node.name}」`, '')
      } catch {
        /* 忽略 */
      }
      toast('已撤回，可继续修改')
      onReload()
    } catch (e: any) {
      toast(e?.message || '撤回失败', 'err')
    } finally {
      setBusy(false)
    }
  }

  async function doReview(pass: boolean) {
    if (!pass && !reviewProblems.trim()) {
      toast('驳回时必须填写“存在问题”', 'err')
      return
    }
    if (!pass && !reviewRequirements.trim()) {
      toast('驳回时必须填写“整改要求”', 'err')
      return
    }
    setBusy(true)
    try {
      const reviewer = perm.member?.name || ''

      if (pending) {
        await updateNodeRequest(pending.id, {
          status: pass ? 'approved' : 'rejected',
          result: pass ? '通过' : '不通过',
          reviewer_name: reviewer,
          review_time: new Date().toISOString(),
          problems: reviewProblems || null,
          requirements: reviewRequirements || null,
        })
      }

      if (pass) {
        const p: any = pending?.payload || {}
        await updateNode(node.id, {
          status: '已通过',
          conclusion: p.conclusion ?? node.conclusion,
          submit_date: p.submit_date ?? node.submit_date,
          due_date: p.due_date ?? node.due_date,
          remark: p.remark ?? node.remark,
          problems: reviewProblems || null,
          requirements: reviewRequirements || null,
          review_comment: '通过',
          reviewer_name: reviewer,
          review_date: todayStr(),
          score: reviewScore === '' ? node.score : Number(reviewScore),
        })
      } else {
        await updateNode(node.id, {
          status: '需整改',
          problems: reviewProblems || null,
          requirements: reviewRequirements || null,
          review_comment: '不通过',
          reviewer_name: reviewer,
          review_date: todayStr(),
        })
      }

      addLog(
        project.id,
        `${pass ? '审核通过' : '审核驳回'}「${node.name}」`,
        reviewProblems || reviewRequirements || '',
      )
      toast(pass ? '审核通过，申请内容已生效' : '已驳回，申请人可修改后重新提交')
      setReviewProblems('')
      setReviewRequirements('')
      setReviewScore('')
      onReload()
    } catch (e: any) {
      toast(e?.message || '操作失败', 'err')
    } finally {
      setBusy(false)
    }
  }

  async function handleFiles(list: FileList | null) {
    if (!list || !list.length) return
    setUploading(true)
    let ok = 0
    try {
      for (const file of Array.from(list)) {
        if (file.size > 50 * 1024 * 1024) {
          toast(`${file.name} 超过 50MB，已跳过`, 'err')
          continue
        }
        await uploadAttachment(project, node, file)
        ok++
      }
      if (ok) {
        addLog(project.id, `上传附件 ${ok} 份`, `节点：${node.name}`)
        toast(`已上传 ${ok} 份文件`)
        onReload()
      }
    } catch (e: any) {
      toast(e?.message || '上传失败', 'err')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  /** 把长中文路径的历史附件迁移到 ASCII 短路径，修复网关 502 */
  async function fixPath(a: Attachment) {
    if (!confirm('将该附件迁移到新的存储路径以修复打不开的问题？文件内容不变，不会影响记录。')) return
    setBusy(true)
    try {
      const r = await relocateAttachment(a)
      toast(r.message, r.ok ? undefined : 'err')
      if (r.ok) onReload()
    } catch (e: any) {
      toast(e?.message || '迁移失败', 'err')
    } finally {
      setBusy(false)
    }
  }

  async function removeFile(a: Attachment) {
    if (!confirm(`确定删除附件「${a.file_name}」（v${a.version}）？\n云端文件将一并删除，删除前会自动备份记录。`))
      return

    let bkId = 0
    try {
      const bk = await createBackup({
        table_name: 'project_attachments',
        record_id: String(a.id),
        project_id: a.project_id,
        payload: { attachment: a },
        operator: perm.member?.name || '',
        status: 'pending',
        note: '删除附件前备份',
      })
      bkId = bk.id
    } catch {
      toast('备份失败，已中止删除', 'err')
      return
    }

    try {
      await deleteAttachment(a)
      await updateBackup(bkId, { status: 'deleted', note: '附件记录已删除，云端文件同时清除' }).catch(() => {})
      try {
        await addLog(project.id, '删除附件', a.file_name)
      } catch {
        /* 忽略 */
      }
      toast('已删除，记录已备份')
      onReload()
    } catch (e: any) {
      await updateBackup(bkId, { status: 'failed', note: `删除失败：${e?.message || e}` }).catch(() => {})
      toast(e?.message || '删除失败', 'err')
    }
  }

  const dirPath = `${getModule(project.module_key).short} / ${project.name} / ${node.name} /`

  return (
    <>
      <div className="card">
        <h3>
          {node.name}
          <span style={{ marginLeft: 8 }}>
            <StatusTag status={f.status} />
          </span>
        </h3>
        <div className="form-grid">
          <Field label="应完成时间">
            <input
              type="date"
              disabled={locked}
              value={String(f.due_date || '').slice(0, 10)}
              onChange={(e) => set('due_date', e.target.value)}
            />
          </Field>
          <Field label={`${node.name}时间`}>
            <input
              type="date"
              disabled={locked}
              value={String(f.submit_date || '').slice(0, 10)}
              onChange={(e) => set('submit_date', e.target.value)}
            />
          </Field>
          <Field label="备注">
            <input disabled={locked} value={f.remark ?? ''} onChange={(e) => set('remark', e.target.value)} />
          </Field>
          <Field label={`${node.name}情况`} full>
            <textarea
              disabled={locked}
              value={f.conclusion ?? ''}
              onChange={(e) => set('conclusion', e.target.value)}
              placeholder="填写本节点完成情况：做了什么、材料是否齐全、有无特殊情况"
            />
          </Field>
        </div>
        <div className="form-actions">
          {canFill && !locked && (
            <button className="btn primary" onClick={submitApply} disabled={busy}>
              {busy ? '提交中…' : pending ? '更新申请' : '提交申请'}
            </button>
          )}
          {locked && (
            <>
              <span className="muted">
                {node.status === '已提交'
                  ? '申请待审核，暂不可修改'
                  : '已审核通过，如需再次变更请提交变更申请'}
              </span>
              {node.status === '已提交' && canFill && pending && (
                <button className="btn" onClick={withdraw} disabled={busy}>
                  撤回申请
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="card">
        <h3>审核结果</h3>
        {latest && (
          <div className="table-wrap" style={{ marginBottom: 12 }}>
            <table className="grid">
              <tbody>
                <tr>
                  <td
                    colSpan={2}
                    style={{ background: '#eef4fb', color: 'var(--brand)', fontWeight: 600, fontSize: 13 }}
                  >
                    {latest.status === 'pending'
                      ? '本次申请内容（待审核，尚未生效）'
                      : latest.status === 'rejected'
                        ? '最近一次被驳回的申请内容（未生效）'
                        : '最近一次审核通过的申请内容（已生效）'}
                  </td>
                </tr>
                <tr>
                  <td style={{ width: 140, background: '#fafbfd', color: '#475569' }}>申请人 / 申请时间</td>
                  <td>
                    {latest.applicant_name || '—'} · {fmtTime(latest.apply_time)}
                  </td>
                </tr>
                <tr>
                  <td style={{ background: '#fafbfd', color: '#475569' }}>{node.name}时间</td>
                  <td>{(latest.payload as any)?.submit_date || '—'}</td>
                </tr>
                <tr>
                  <td style={{ background: '#fafbfd', color: '#475569' }}>{node.name}情况</td>
                  <td style={{ whiteSpace: 'pre-wrap' }}>{(latest.payload as any)?.conclusion || '—'}</td>
                </tr>
                {(latest.payload as any)?.remark && (
                  <tr>
                    <td style={{ background: '#fafbfd', color: '#475569' }}>备注</td>
                    <td>{(latest.payload as any)?.remark}</td>
                  </tr>
                )}
                {latest.review_time && (
                  <tr>
                    <td style={{ background: '#fafbfd', color: '#475569' }}>审核结果</td>
                    <td>
                      <span className={`tag ${latest.status === 'approved' ? 'ok' : 'danger'}`}>
                        {latest.result || (latest.status === 'approved' ? '通过' : '不通过')}
                      </span>
                      <span className="muted" style={{ marginLeft: 8 }}>
                        {latest.reviewer_name || '—'} · {fmtTime(latest.review_time)}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-wrap" style={{ marginBottom: 12 }}>
          <table className="grid">
            <tbody>
              <tr>
                <td style={{ width: 140, background: '#fafbfd', color: '#475569' }}>当前状态</td>
                <td>
                  <StatusTag status={node.status} />
                </td>
              </tr>
              <tr>
                <td style={{ background: '#fafbfd', color: '#475569' }}>填报人 / 填报时间</td>
                <td>
                  {node.submitter_name || '—'}
                  {node.submit_date ? ` · ${String(node.submit_date).slice(0, 10)}` : ''}
                </td>
              </tr>
              <tr>
                <td style={{ background: '#fafbfd', color: '#475569' }}>审核结论</td>
                <td>
                  {node.review_comment ? (
                    <span className={`tag ${node.review_comment === '通过' ? 'ok' : node.review_comment === '不通过' ? 'danger' : 'info'}`}>
                      {node.review_comment}
                    </span>
                  ) : (
                    <span className="muted">尚未审核</span>
                  )}
                </td>
              </tr>
              <tr>
                <td style={{ background: '#fafbfd', color: '#475569' }}>审核人 / 审核时间</td>
                <td>
                  {node.reviewer_name || '—'}
                  {node.review_date ? ` · ${String(node.review_date).slice(0, 10)}` : ''}
                </td>
              </tr>
              <tr>
                <td style={{ background: '#fafbfd', color: '#475569' }}>存在问题</td>
                <td style={{ whiteSpace: 'pre-wrap' }}>{node.problems || '—'}</td>
              </tr>
              <tr>
                <td style={{ background: '#fafbfd', color: '#475569' }}>整改要求</td>
                <td style={{ whiteSpace: 'pre-wrap' }}>{node.requirements || '—'}</td>
              </tr>
              {node.score !== null && node.score !== undefined && (
                <tr>
                  <td style={{ background: '#fafbfd', color: '#475569' }}>评分</td>
                  <td>{node.score}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {perm.canReview && node.status === '已提交' && (
          <div>
            {!pending && (
              <div className="muted" style={{ marginBottom: 10 }}>
                该节点没有关联的申请记录（可能由旧版页面提交），可直接按当前填写内容完成审核。
              </div>
            )}
            <div className="form-grid">
              <Field label="存在问题" full>
                <textarea
                  value={reviewProblems}
                  onChange={(e) => setReviewProblems(e.target.value)}
                  placeholder="审核不通过时必填"
                />
              </Field>
              <Field label="整改要求" full>
                <textarea
                  value={reviewRequirements}
                  onChange={(e) => setReviewRequirements(e.target.value)}
                  placeholder="审核不通过时必填，写清整改内容与时限"
                />
              </Field>
              <Field label="评分（百分制，选填）">
                <input type="number" value={reviewScore} onChange={(e) => setReviewScore(e.target.value)} />
              </Field>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={() => doReview(true)} disabled={busy}>
                审核通过
              </button>
              <button className="btn danger" onClick={() => doReview(false)} disabled={busy}>
                审核不通过
              </button>
            </div>
          </div>
        )}

        {node.status === '需整改' && canFill && (
          <div className="muted">审核未通过，请按上方整改要求修改后重新提交。</div>
        )}
        {node.status === '已提交' && !perm.canReview && <div className="muted">已提交，等待审核。</div>}
        {node.status === '已通过' && <div className="muted">已审核通过。</div>}
      </div>

      <div className="card">
        <h3>节点材料（{files.length} 份）</h3>
        <div className="path-eg">存放路径：{dirPath}</div>

        {canFill && !locked && (
          <>
            <div
              className={`dropzone ${over ? 'over' : ''}`}
              style={{ marginTop: 12 }}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(true)
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setOver(false)
                handleFiles(e.dataTransfer.files)
              }}
            >
              {uploading
                ? '正在上传…'
                : '点击选择文件，或把文件拖到这里（支持 doc/docx/pdf/xls/xlsx/图片/压缩包，单份≤50MB）'}
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </>
        )}

        {files.length === 0 ? (
          <div className="empty">这个节点还没有上传材料。</div>
        ) : (
          files.map((a) => (
            <div className="attach-row" key={a.id}>
              <div style={{ minWidth: 0 }}>
                <div className="fname">{a.file_name}</div>
                <div className="meta">
                  v{a.version} · {fmtSize(a.size)} · {fmtTime(a.created_at)}
                  {a.remark ? ` · ${a.remark}` : ''}
                </div>
              </div>
              <div className="acts">
                {pathHasCJK(a.storage_path) && (canFill || perm.canReview) && (
                  <button
                    className="btn sm"
                    onClick={() => fixPath(a)}
                    title="旧路径含中文，可能导致打不开或预览失败，点击迁移"
                  >
                    修复路径
                  </button>
                )}
                <button className="btn sm primary" onClick={() => setPreview(a)}>
                  预览
                </button>
                <button
                  className="btn sm"
                  onClick={() => downloadAttachment(a).catch((e) => toast(e?.message || '下载失败', 'err'))}
                >
                  下载
                </button>
                {canFill && !locked && (
                  <button className="btn sm danger" onClick={() => removeFile(a)}>
                    删除
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {preview && (
        <AttachmentPreview
          path={preview.storage_path}
          name={preview.file_name}
          mime={preview.mime}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  )
}
