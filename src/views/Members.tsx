import { useState } from 'react'
import { createBackup, createMember, deleteMember, updateBackup, updateMember } from '../api'
import { normPhone } from '../auth'
import { DEPARTMENTS } from '../modules'
import { Field, Modal, toast } from '../ui'
import type { Member, Project } from '../types'

export default function Members({
  members,
  meId,
  canEdit,
  projects,
  onReload,
}: {
  members: Member[]
  meId: string | null
  canEdit: boolean
  projects: Project[]
  onReload: () => void
}) {
  const [editing, setEditing] = useState<Member | null>(null)
  const [creating, setCreating] = useState(false)

  async function toggle(m: Member, key: 'active') {
    try {
      await updateMember(m.id, { [key]: !m[key] } as any)
      toast(m.active ? '已停用' : '已启用')
      onReload()
    } catch (e: any) {
      toast(e?.message || '操作失败', 'err')
    }
  }

  async function remove(m: Member) {
    if (String(m.user_id || '') === meId) {
      toast('不能删除当前登录的账号', 'err')
      return
    }
    if (!confirm(`确定删除成员「${m.name}」？该账号将无法再登录本系统。\n删除前会自动备份记录。`)) return

    let bkId = 0
    try {
      const bk = await createBackup({
        table_name: 'members',
        record_id: String(m.id),
        payload: { member: m },
        operator: meId || '',
        status: 'pending',
        note: '删除成员前备份',
      })
      bkId = bk.id
    } catch {
      toast('备份失败，已中止删除', 'err')
      return
    }

    try {
      await deleteMember(m.id)
      await updateBackup(bkId, { status: 'deleted', note: '成员记录已删除' }).catch(() => {})
      toast('已删除，记录已备份')
      onReload()
    } catch (e: any) {
      await updateBackup(bkId, { status: 'failed', note: `删除失败：${e?.message || e}` }).catch(() => {})
      toast(e?.message || '删除失败', 'err')
    }
  }

  return (
    <>
      <div className="toolbar">
        <div className="muted">
          共 {members.length} 人，其中启用 {members.filter((m) => m.active).length} 人。只有名单内且已启用的人员可以登录系统。
        </div>
        <div className="spacer" />
        {canEdit ? (
          <button className="btn primary" onClick={() => setCreating(true)}>
            + 添加人员
          </button>
        ) : (
          <span className="muted">只读查看（仅管理员与审核人可编辑名单）</span>
        )}
      </div>

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th style={{ width: 130 }}>姓名</th>
              <th style={{ width: 140 }}>手机号</th>
              <th style={{ width: 90 }}>登录绑定</th>
              <th style={{ width: 90 }}>名下课程</th>
              <th>院部</th>
              <th style={{ width: 80 }}>管理员</th>
              <th style={{ width: 80 }}>填报</th>
              <th style={{ width: 80 }}>审核</th>
              <th style={{ width: 80 }}>状态</th>
              <th style={{ width: 150 }}></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.name}
                  {String(m.user_id || '') === meId && <span className="tag info" style={{ marginLeft: 6 }}>本人</span>}
                </td>
                <td className="nowrap">{m.phone || '—'}</td>
                <td>
                  {m.user_id ? <span className="tag ok">已绑定</span> : <span className="tag warn">未绑定</span>}
                </td>
                <td>
                  {(() => {
                    const n = projects.filter((p) => p.contributor_id === m.id).length
                    if (!n) return <span className="muted">—</span>
                    return m.user_id ? <span>{n} 门</span> : <span className="tag warn">{n} 门·未激活</span>
                  })()}
                </td>
                <td>{m.dept || '—'}</td>
                <td>{m.is_admin ? <span className="tag info">管理员</span> : '—'}</td>
                <td>{m.can_submit || m.is_admin ? '✓' : '—'}</td>
                <td>{m.can_review || m.is_admin ? '✓' : '—'}</td>
                <td>{m.active ? <span className="tag ok">启用</span> : <span className="tag danger">停用</span>}</td>
                <td className="nowrap">
                  {canEdit ? (
                    <>
                      <button className="btn sm" onClick={() => setEditing(m)}>
                        编辑
                      </button>{' '}
                      <button className="btn sm" onClick={() => toggle(m, 'active')}>
                        {m.active ? '停用' : '启用'}
                      </button>{' '}
                      <button className="btn sm danger" onClick={() => remove(m)}>
                        删除
                      </button>
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={10}>
                  <div className="empty">还没有成员。</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <MemberForm
          initial={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onDone={onReload}
        />
      )}
    </>
  )
}

function MemberForm({
  initial,
  onClose,
  onDone,
}: {
  initial: Member | null
  onClose: () => void
  onDone: () => void
}) {
  const [f, setF] = useState<any>({
    name: initial?.name || '',
    phone: initial?.phone || '',
    dept: initial?.dept || '',
    is_admin: initial?.is_admin ?? false,
    can_submit: initial?.can_submit ?? true,
    can_review: initial?.can_review ?? false,
    active: initial?.active ?? true,
    remark: initial?.remark || '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }))

  async function save() {
    setErr('')
    if (!f.name.trim()) return setErr('请填写姓名')
    const phone = normPhone(f.phone)
    if (phone && phone.length !== 11) return setErr('手机号需为 11 位')
    if (!phone) return setErr('请填写手机号，该号码用于登录识别')

    setBusy(true)
    try {
      const payload = {
        name: f.name.trim(),
        phone,
        dept: f.dept || null,
        is_admin: !!f.is_admin,
        can_submit: !!f.can_submit,
        can_review: !!f.can_review,
        active: !!f.active,
        remark: f.remark || null,
      }
      if (initial) await updateMember(initial.id, payload)
      else await createMember(payload)
      toast(initial ? '已保存' : '已添加，通知对方用该手机号登录即可')
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
      title={initial ? '编辑人员' : '添加人员'}
      size="sm"
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
        <Field label="姓名" required>
          <input value={f.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="手机号" required>
          <input
            value={f.phone}
            maxLength={11}
            onChange={(e) => set('phone', e.target.value.replace(/\D/g, ''))}
            placeholder="用于登录识别"
          />
        </Field>
        <Field label="院部" full>
          <input list="member-dept" value={f.dept} onChange={(e) => set('dept', e.target.value)} />
          <datalist id="member-dept">
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>
        <Field label="备注" full>
          <input value={f.remark} onChange={(e) => set('remark', e.target.value)} />
        </Field>
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={f.is_admin} onChange={(e) => set('is_admin', e.target.checked)} />
          <span>管理员（可管理人员名单，拥有全部权限）</span>
        </label>
        <label className="row" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={f.can_submit}
            disabled={f.is_admin}
            onChange={(e) => set('can_submit', e.target.checked)}
          />
          <span>填写并提交项目信息</span>
        </label>
        <label className="row" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={f.can_review}
            disabled={f.is_admin}
            onChange={(e) => set('can_review', e.target.checked)}
          />
          <span>审核项目与教材信息（勾选后同时具备节点填报能力）</span>
        </label>
        <label className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} />
          <span>启用（取消后该人员无法登录）</span>
        </label>
      </div>

      {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{err}</div>}
    </Modal>
  )
}
