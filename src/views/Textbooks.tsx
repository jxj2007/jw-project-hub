import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createBackup,
  createTextbook,
  deleteTextbook,
  listTextbooks,
  updateBackup,
  updateTextbook,
  uploadContract,
} from '../api'
import AttachmentPreview from '../components/AttachmentPreview'
import { fmtDate } from '../modules'
import { REVIEW_STATUS_LABEL, TEXTBOOK_TYPES } from '../types'
import type { Perm, Project, Textbook } from '../types'
import { Field, Modal, toast } from '../ui'

export default function Textbooks({
  projects,
  perm,
  onOpenProject,
}: {
  projects: Project[]
  perm: Perm
  onOpenProject: (projectId: number) => void
}) {
  const [list, setList] = useState<Textbook[]>([])
  const [loading, setLoading] = useState(true)
  const [kw, setKw] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState<Textbook | null>(null)
  const [creating, setCreating] = useState(false)
  const [reviewing, setReviewing] = useState<Textbook | null>(null)
  const [preview, setPreview] = useState<{ path: string; name: string } | null>(null)

  async function load() {
    setLoading(true)
    try {
      setList(await listTextbooks())
    } catch (e: any) {
      toast(e?.message || '教材数据加载失败', 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase()
    return list.filter((t) => {
      if (typeFilter && t.textbook_type !== typeFilter) return false
      if (statusFilter && t.review_status !== statusFilter) return false
      if (!k) return true
      return [t.name, t.editor, t.partner, t.publisher, t.project_code]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(k))
    })
  }, [list, kw, typeFilter, statusFilter])

  const projById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  async function submitReview(t: Textbook) {
    if (!t.has_contract) {
      if (!confirm('该教材尚未标记“已签订出版合同”，仍要提交审核吗？')) return
    }
    try {
      await updateTextbook(t.id, {
        review_status: 'pending',
        submit_time: new Date().toISOString(),
        submitter_name: perm.member?.name || '',
        reviewer_name: null,
        review_time: null,
        review_comment: null,
      })
      toast('已提交审核')
      load()
    } catch (e: any) {
      toast(e?.message || '提交失败', 'err')
    }
  }

  async function remove(t: Textbook) {
    if (!confirm(`确定删除教材「${t.name}」？\n出版合同等附件将一并删除，删除前会自动备份记录。`)) return

    let bkId = 0
    try {
      const bk = await createBackup({
        table_name: 'textbooks',
        record_id: String(t.id),
        project_id: t.project_id,
        payload: { textbook: t },
        operator: perm.member?.name || '',
        status: 'pending',
        note: '删除教材前备份',
      })
      bkId = bk.id
    } catch {
      toast('备份失败，已中止删除', 'err')
      return
    }

    try {
      await deleteTextbook(t.id, t.contract_path)
      await updateBackup(bkId, { status: 'deleted', note: '教材记录已删除，合同文件同时清除' }).catch(() => {})
      toast('已删除，记录已备份')
      load()
    } catch (e: any) {
      await updateBackup(bkId, { status: 'failed', note: `删除失败：${e?.message || e}` }).catch(() => {})
      toast(e?.message || '删除失败', 'err')
    }
  }

  async function openContract(t: Textbook) {
    if (!t.contract_path) {
      toast('该教材尚未上传出版合同文件', 'err')
      return
    }
    setPreview({ path: t.contract_path, name: t.contract_name || '出版合同.pdf' })
  }

  return (
    <>
      <div className="toolbar">
        <input
          type="text"
          placeholder="搜索教材名称 / 主编 / 企业 / 项目编号"
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          style={{ minWidth: 260 }}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">全部类型</option>
          {TEXTBOOK_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">全部状态</option>
          {Object.entries(REVIEW_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <div className="spacer" />
        <button className="btn" onClick={load} disabled={loading}>
          刷新
        </button>
        {perm.canSubmit && (
          <button className="btn primary" onClick={() => setCreating(true)}>
            + 新增教材
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading">加载中…</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty">
            还没有教材记录。点右上角「新增教材」，选一门课程关联后录入。
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: 150 }}>课程项目编号</th>
                <th>教材名称</th>
                <th style={{ width: 90 }}>主编</th>
                <th style={{ width: 140 }}>合作企业</th>
                <th style={{ width: 100 }}>教材类型</th>
                <th style={{ width: 130 }}>出版社</th>
                <th style={{ width: 100 }}>出版时间</th>
                <th style={{ width: 80 }}>出版合同</th>
                <th style={{ width: 90 }}>审核状态</th>
                <th style={{ width: 210 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td className="nowrap">
                    {t.project_code ? (
                      <button
                        className="btn ghost"
                        style={{ padding: 0 }}
                        onClick={() => t.project_id && onOpenProject(t.project_id)}
                        title="跳转到课程"
                      >
                        {t.project_code}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {t.name}
                    {t.remark && <div className="muted">{t.remark}</div>}
                  </td>
                  <td>{t.editor || '—'}</td>
                  <td>{t.partner || '—'}</td>
                  <td>{t.textbook_type || '—'}</td>
                  <td>{t.publisher || '—'}</td>
                  <td>{fmtDate(t.publish_date)}</td>
                  <td>
                    {t.has_contract ? (
                      t.contract_path ? (
                        <button className="btn ghost" style={{ padding: 0 }} onClick={() => openContract(t)}>
                          已签·查看
                        </button>
                      ) : (
                        <span className="tag warn">已签·未上传</span>
                      )
                    ) : (
                      <span className="tag">未签</span>
                    )}
                  </td>
                  <td>
                    <StatusPill status={t.review_status} />
                  </td>
                  <td className="nowrap">
                    {perm.canSubmit && (t.review_status === 'draft' || t.review_status === 'rejected') && (
                      <>
                        <button className="btn sm" onClick={() => setEditing(t)}>
                          编辑
                        </button>{' '}
                        <button className="btn sm primary" onClick={() => submitReview(t)}>
                          提交审核
                        </button>{' '}
                      </>
                    )}
                    {perm.canReview && t.review_status === 'pending' && (
                      <button className="btn sm primary" onClick={() => setReviewing(t)}>
                        审核
                      </button>
                    )}{' '}
                    {perm.canSubmit && (
                      <button className="btn sm danger" onClick={() => remove(t)}>
                        删除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <TextbookForm
          initial={editing}
          projects={projects}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onDone={load}
        />
      )}

      {reviewing && (
        <ReviewModal
          textbook={reviewing}
          reviewerName={perm.member?.name || ''}
          onPreview={(path, name) => setPreview({ path, name })}
          onClose={() => setReviewing(null)}
          onDone={load}
        />
      )}

      {preview && (
        <AttachmentPreview
          path={preview.path}
          name={preview.name}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  )
}

function StatusPill({ status }: { status: string }) {
  const cls = status === 'approved' ? 'ok' : status === 'pending' ? 'info' : status === 'rejected' ? 'danger' : ''
  return <span className={`tag ${cls}`}>{REVIEW_STATUS_LABEL[status] || status}</span>
}

/* --------------------------------- 教材表单 -------------------------------- */

function TextbookForm({
  initial,
  projects,
  onClose,
  onDone,
}: {
  initial: Textbook | null
  projects: Project[]
  onClose: () => void
  onDone: () => void
}) {
  const [f, setF] = useState<any>({
    project_id: initial?.project_id ?? '',
    project_code: initial?.project_code || '',
    name: initial?.name || '',
    editor: initial?.editor || '',
    partner: initial?.partner || '',
    textbook_type: initial?.textbook_type || '',
    publisher: initial?.publisher || '',
    publish_date: initial?.publish_date ? String(initial.publish_date).slice(0, 10) : '',
    has_contract: initial?.has_contract ?? false,
    contract_name: initial?.contract_name || '',
    contract_path: initial?.contract_path || '',
    remark: initial?.remark || '',
  })
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }))

  function pickProject(idStr: string) {
    const p = projects.find((x) => String(x.id) === idStr)
    set('project_id', idStr)
    set('project_code', p?.code || '')
  }

  async function handleFile(file?: File | null) {
    if (!file) return
    setUploading(true)
    try {
      const r = await uploadContract({ project_code: f.project_code, name: f.name }, file)
      set('contract_name', r.contract_name)
      set('contract_path', r.contract_path)
      set('has_contract', true)
      toast('合同已上传')
    } catch (e: any) {
      toast(e?.message || '上传失败', 'err')
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    setErr('')
    if (!f.name.trim()) return setErr('请填写教材名称')
    if (!f.project_id) return setErr('请选择关联课程')

    setBusy(true)
    try {
      const payload: any = {
        project_id: Number(f.project_id),
        project_code: f.project_code || null,
        name: f.name.trim(),
        editor: f.editor || null,
        partner: f.partner || null,
        textbook_type: f.textbook_type || null,
        publisher: f.publisher || null,
        publish_date: f.publish_date || null,
        has_contract: !!f.has_contract,
        contract_name: f.contract_name || null,
        contract_path: f.contract_path || null,
        remark: f.remark || null,
      }
      if (initial) await updateTextbook(initial.id, payload)
      else await createTextbook({ ...payload, review_status: 'draft' })
      toast(initial ? '已保存' : '已新增，完善后可提交审核')
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
      title={initial ? '编辑教材' : '新增教材'}
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
        <Field label="关联课程" required full>
          <select value={String(f.project_id)} onChange={(e) => pickProject(e.target.value)}>
            <option value="">请选择课程（按项目编号关联）</option>
            {projects.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.code ? `${p.code} · ` : ''}
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="课程项目编号">
          <input value={f.project_code} readOnly placeholder="选择课程后自动带出" />
        </Field>
        <Field label="教材名称" required>
          <input value={f.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="主编姓名">
          <input value={f.editor} onChange={(e) => set('editor', e.target.value)} />
        </Field>
        <Field label="合作企业">
          <input value={f.partner} onChange={(e) => set('partner', e.target.value)} />
        </Field>
        <Field label="教材类型">
          <select value={f.textbook_type} onChange={(e) => set('textbook_type', e.target.value)}>
            <option value="">请选择</option>
            {TEXTBOOK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="出版社">
          <input value={f.publisher} onChange={(e) => set('publisher', e.target.value)} />
        </Field>
        <Field label="出版时间">
          <input type="date" value={f.publish_date} onChange={(e) => set('publish_date', e.target.value)} />
        </Field>
        <Field label="备注">
          <input value={f.remark} onChange={(e) => set('remark', e.target.value)} />
        </Field>
      </div>

      <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <label className="row" style={{ cursor: 'pointer', marginBottom: 10 }}>
          <input type="checkbox" checked={f.has_contract} onChange={(e) => set('has_contract', e.target.checked)} />
          <span>已签订出版合同</span>
        </label>

        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? '上传中…' : f.contract_path ? '重新上传合同' : '上传出版合同'}
          </button>
          {f.contract_name && <span className="muted">{f.contract_name}</span>}
          {f.contract_path && !f.contract_name && <span className="muted">合同已上传</span>}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.png,.zip"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className="muted" style={{ marginTop: 8 }}>
          合同存放路径：教材 / 课程编号-课程名 / 文件名
        </div>
      </div>

      {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{err}</div>}
    </Modal>
  )
}

/* --------------------------------- 审核弹窗 -------------------------------- */

function ReviewModal({
  textbook,
  reviewerName,
  onPreview,
  onClose,
  onDone,
}: {
  textbook: Textbook
  reviewerName: string
  onPreview: (path: string, name: string) => void
  onClose: () => void
  onDone: () => void
}) {
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  async function decide(pass: boolean) {
    if (!pass && !comment.trim()) {
      toast('退回时必须填写审核意见', 'err')
      return
    }
    setBusy(true)
    try {
      await updateTextbook(textbook.id, {
        review_status: pass ? 'approved' : 'rejected',
        reviewer_name: reviewerName,
        review_time: new Date().toISOString(),
        review_comment: comment || null,
      })
      toast(pass ? '审核通过' : '已退回')
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
      title="教材出版前审核"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button className="btn danger" onClick={() => decide(false)} disabled={busy}>
            退回整改
          </button>
          <button className="btn primary" onClick={() => decide(true)} disabled={busy}>
            审核通过
          </button>
        </>
      }
    >
      <div className="table-wrap" style={{ marginBottom: 14 }}>
        <table className="grid">
          <tbody>
            <tr>
              <td style={{ width: 110, background: '#fafbfd' }}>教材名称</td>
              <td>{textbook.name}</td>
            </tr>
            <tr>
              <td style={{ background: '#fafbfd' }}>课程编号</td>
              <td>{textbook.project_code || '—'}</td>
            </tr>
            <tr>
              <td style={{ background: '#fafbfd' }}>主编 / 企业</td>
              <td>
                {textbook.editor || '—'} / {textbook.partner || '—'}
              </td>
            </tr>
            <tr>
              <td style={{ background: '#fafbfd' }}>类型</td>
              <td>{textbook.textbook_type || '—'}</td>
            </tr>
            <tr>
              <td style={{ background: '#fafbfd' }}>出版信息</td>
              <td>
                {textbook.publisher || '—'} · {fmtDate(textbook.publish_date)}
              </td>
            </tr>
            <tr>
              <td style={{ background: '#fafbfd' }}>出版合同</td>
              <td>
                {textbook.has_contract ? (
                  textbook.contract_path ? (
                        <button
                          className="btn ghost"
                          style={{ padding: 0 }}
                          onClick={() => onPreview(textbook.contract_path!, textbook.contract_name || '出版合同.pdf')}
                        >
                      查看合同
                    </button>
                  ) : (
                    '已签订，未上传文件'
                  )
                ) : (
                  '未签订'
                )}
              </td>
            </tr>
            <tr>
              <td style={{ background: '#fafbfd' }}>提交人</td>
              <td>{textbook.submitter_name || '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Field label="审核意见（退回时必填）" full>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
    </Modal>
  )
}
