import { useEffect, useState } from 'react'
import { createProject, updateProject, createNode, addLog, nextProjectCode } from '../api'
import { fetchMembers } from '../auth'
import { COMMON_FIELDS, DEPARTMENTS, MODULES, getModule } from '../modules'
import { Field, Modal, toast } from '../ui'
import type { Member, Project } from '../types'

const LEVELS = ['国家级', '省级', '市级', '校级', '院级']

export default function ProjectForm({
  moduleKey,
  initial,
  onClose,
  onDone,
}: {
  moduleKey: string
  initial?: Project | null
  onClose: () => void
  onDone: () => void
}) {
  const mod = getModule(moduleKey)
  const [form, setForm] = useState<any>(() => ({
    name: initial?.name || '',
    code: initial?.code || '',
    contributor_id: initial?.contributor_id ?? '',
    dept: initial?.dept || '',
    leader: initial?.leader || '',
    members: initial?.members || '',
    phone: initial?.phone || '',
    category: initial?.category || '',
    level: initial?.level || '',
    year: initial?.year ?? '',
    start_month: initial?.start_month || '',
    end_month: initial?.end_month || '',
    funding: initial?.funding ?? '',
    remark: initial?.remark || '',
    ...(initial?.extra || {}),
  }))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    fetchMembers()
      .then((ms) => setMembers(ms))
      .catch(() => {})
  }, [])

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const commonKeys = COMMON_FIELDS.map((f) => f.key)
  const extraKeys = mod.fields.map((f) => f.key)

  function label(key: string) {
    if (key === 'name') return mod.nameLabel
    if (key === 'leader') return mod.leaderLabel
    if (key === 'code') return '项目编号'
    return COMMON_FIELDS.find((f) => f.key === key)?.label || key
  }

  async function save() {
    setErr('')
    if (!form.name.trim()) return setErr(`${mod.nameLabel}不能为空`)
    if (!form.leader.trim()) return setErr(`${mod.leaderLabel}不能为空`)

    const extra: Record<string, any> = {}
    for (const k of extraKeys) {
      if (form[k] !== '' && form[k] !== undefined && form[k] !== null) extra[k] = form[k]
    }

    const payload: any = {
      module_key: moduleKey,
      name: form.name.trim(),
      code: form.code || null,
      contributor_id: form.contributor_id ? Number(form.contributor_id) : null,
      dept: form.dept || null,
      leader: form.leader.trim(),
      members: form.members || null,
      phone: form.phone || null,
      category: form.category || null,
      level: form.level || null,
      year: form.year === '' ? null : Number(form.year),
      start_month: form.start_month || null,
      end_month: form.end_month || null,
      funding: form.funding === '' ? null : Number(form.funding),
      remark: form.remark || null,
      extra,
    }

    setBusy(true)
    try {
      if (initial) {
        await updateProject(initial.id, payload)
        addLog(initial.id, '修改基本信息')
        toast('已保存')
      } else {
        if (moduleKey === 'three100' && !form.code) {
          payload.code = await nextProjectCode()
        }
        const created = await createProject({ ...payload, status: '进行中', stage: mod.nodeTemplates[0] })
        for (let i = 0; i < mod.nodeTemplates.length; i++) {
          await createNode(created.id, mod.nodeTemplates[i], i)
        }
        addLog(created.id, '新建' + mod.itemLabel)
        toast(`已新建${mod.itemLabel}，并生成 ${mod.nodeTemplates.length} 个节点`)
      }
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
      title={initial ? `编辑${mod.itemLabel}` : `新增${mod.itemLabel}`}
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
        {COMMON_FIELDS.filter((f) => f.key === 'name' || f.key === 'code').map((f) => {
          const autoCode = f.key === 'code' && moduleKey === 'three100'
          return (
            <Field key={f.key} label={label(f.key)} required={f.required} full={f.key === 'name'}>
              <input
                value={form[f.key] ?? ''}
                onChange={(e) => set(f.key, e.target.value)}
                readOnly={autoCode}
                placeholder={autoCode ? '保存时自动生成，如 XMHKC202601029' : ''}
                style={autoCode ? { background: '#f6f8fb', color: '#475569' } : undefined}
              />
            </Field>
          )
        })}

        {mod.fields.map((f) => (
          <Field key={f.key} label={f.label} full={f.width === 'full'}>
            {f.type === 'select' ? (
              <select value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}>
                <option value="">请选择</option>
                {(f.options || []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.type === 'number' ? 'number' : 'text'}
                value={form[f.key] ?? ''}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
          </Field>
        ))}

        <Field label={label('dept')}>
          <input
            list="dept-list"
            value={form.dept ?? ''}
            onChange={(e) => set('dept', e.target.value)}
            placeholder="如 智能制造学院"
          />
          <datalist id="dept-list">
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>

        {COMMON_FIELDS.filter((f) => ['leader', 'members', 'phone'].includes(f.key)).map((f) => (
          <Field key={f.key} label={label(f.key)} required={f.required}>
            <input value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
          </Field>
        ))}

        <Field label="填报人（关联登录账号）">
          <select
            value={String(form.contributor_id ?? '')}
            onChange={(e) => {
              const v = e.target.value
              set('contributor_id', v)
              const m = members.find((x) => String(x.id) === v)
              if (m && !String(form.leader || '').trim()) set('leader', m.name)
            }}
          >
            <option value="">不指定（仅管理员与审核人可见）</option>
            {members.map((m) => (
              <option key={m.id} value={String(m.id)}>
                {m.name}
                {m.dept ? ` · ${m.dept}` : ''}
                {m.user_id ? '' : '（未绑定登录）'}
              </option>
            ))}
          </select>
        </Field>

        <Field label="类别">
          <input
            value={form.category ?? ''}
            onChange={(e) => set('category', e.target.value)}
            placeholder="按模块习惯填写"
          />
        </Field>

        <Field label="级别">
          <select value={form.level ?? ''} onChange={(e) => set('level', e.target.value)}>
            <option value="">请选择</option>
            {LEVELS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>

        <Field label="立项年度">
          <input type="number" value={form.year ?? ''} onChange={(e) => set('year', e.target.value)} />
        </Field>

        <Field label="经费（万元）">
          <input type="number" value={form.funding ?? ''} onChange={(e) => set('funding', e.target.value)} />
        </Field>

        <Field label="建设起始">
          <input
            value={form.start_month ?? ''}
            placeholder="2026-03"
            onChange={(e) => set('start_month', e.target.value)}
          />
        </Field>

        <Field label="建设截止">
          <input
            value={form.end_month ?? ''}
            placeholder="2028-12"
            onChange={(e) => set('end_month', e.target.value)}
          />
        </Field>

        <Field label="备注" full>
          <textarea value={form.remark ?? ''} onChange={(e) => set('remark', e.target.value)} />
        </Field>
      </div>

      {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{err}</div>}
    </Modal>
  )
}
