import { useRef, useState } from 'react'
import { addLog, createNode, createProject } from '../api'
import { getModule } from '../modules'
import { parseCsv, pick } from '../csv'
import { Modal, toast } from '../ui'
import type { Project } from '../types'

type Draft = {
  name: string
  leader: string
  dept: string
  category: string
  level: string
  year: string
  funding: string
  code: string
  remark: string
  extra: Record<string, string>
}

const ALIAS = {
  name: ['课程名称', '项目名称', '名称', 'name'],
  leader: ['课程主持人', '主持人', '负责人', 'leader'],
  dept: ['部门', '所属院部', '院部', '开课院部', 'dept'],
  category: ['课程性质', '类别', 'category'],
  level: ['级别', 'level'],
  year: ['立项年度', '年度', 'year'],
  funding: ['经费', '经费(万元)', '经费（万元）', 'funding'],
  code: ['序号', '编号', '课程代码', 'code'],
  remark: ['备注', 'remark'],
}

export default function ImportModal({
  moduleKey,
  onClose,
  onDone,
}: {
  moduleKey: string
  onClose: () => void
  onDone: () => void
}) {
  const mod = getModule(moduleKey)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [filename, setFilename] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(file?: File | null) {
    if (!file) return
    setErr('')
    setFilename(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result || ''))
        if (rows.length < 2) {
          setErr('文件内容为空，或只有表头')
          return
        }
        const headers = rows[0].map((h) => String(h).trim())
        const out: Draft[] = []
        for (let i = 1; i < rows.length; i++) {
          const rec: Record<string, string> = {}
          headers.forEach((h, j) => (rec[h] = rows[i][j] ?? ''))
          const name = pick(rec, ALIAS.name)
          if (!name) continue
          const extra: Record<string, string> = {}
          for (const f of mod.fields) {
            const v = pick(rec, [f.label, f.key])
            if (v) extra[f.key] = v
          }
          out.push({
            name,
            leader: pick(rec, ALIAS.leader),
            dept: pick(rec, ALIAS.dept),
            category: pick(rec, ALIAS.category),
            level: pick(rec, ALIAS.level),
            year: pick(rec, ALIAS.year),
            funding: pick(rec, ALIAS.funding),
            code: pick(rec, ALIAS.code),
            remark: pick(rec, ALIAS.remark),
            extra,
          })
        }
        if (!out.length) {
          setErr('没有识别到有效数据，请检查表头是否包含「' + mod.nameLabel + '」列')
          return
        }
        setDrafts(out)
      } catch (e: any) {
        setErr(e?.message || '文件解析失败')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function doImport() {
    setBusy(true)
    let ok = 0
    try {
      for (let i = 0; i < drafts.length; i++) {
        const d = drafts[i]
        setProgress(`${i + 1} / ${drafts.length}`)
        const payload: any = {
          module_key: moduleKey,
          name: d.name,
          leader: d.leader || null,
          dept: d.dept || null,
          category: d.category || null,
          level: d.level || null,
          code: d.code || null,
          year: d.year && !isNaN(Number(d.year)) ? Number(d.year) : null,
          funding: d.funding && !isNaN(Number(d.funding)) ? Number(d.funding) : null,
          remark: d.remark || null,
          status: '进行中',
          stage: mod.nodeTemplates[0],
          extra: d.extra,
        }
        const created: Project = await createProject(payload)
        for (let k = 0; k < mod.nodeTemplates.length; k++) {
          await createNode(created.id, mod.nodeTemplates[k], k)
        }
        ok++
      }
      addLog(null, '批量导入', `${mod.name} 共 ${ok} 条`)
      toast(`导入完成，共 ${ok} 条`)
      onDone()
      onClose()
    } catch (e: any) {
      setErr(`已导入 ${ok} 条后中断：${e?.message || e}`)
      onDone()
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <Modal
      title={`批量导入${mod.itemLabel}`}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="btn primary" onClick={doImport} disabled={busy || drafts.length === 0}>
            {busy ? `导入中 ${progress}` : `确认导入 ${drafts.length} 条`}
          </button>
        </>
      }
    >
      <p className="muted" style={{ marginTop: 0, lineHeight: 1.8 }}>
        上传 CSV 文件（UTF-8）。表头需包含「{mod.nameLabel}」列，其余列按名称自动匹配：
        <br />
        <b>{mod.leaderLabel}</b>、部门/院部、课程性质/类别、级别、立项年度、经费、编号、备注
        {mod.fields.length > 0 && `、${mod.fields.map((f) => f.label).join('、')}`}
        <br />
        导入后每条自动生成 {mod.nodeTemplates.join(' / ')} 三个节点。
      </p>

      <div className="dropzone" onClick={() => fileRef.current?.click()}>
        {filename || '点击选择 CSV 文件'}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{err}</div>}

      {drafts.length > 0 && (
        <div className="table-wrap" style={{ maxHeight: 300, marginTop: 12 }}>
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>{mod.nameLabel}</th>
                <th>{mod.leaderLabel}</th>
                <th>院部</th>
                <th>类别</th>
              </tr>
            </thead>
            <tbody>
              {drafts.slice(0, 60).map((d, i) => (
                <tr key={i}>
                  <td className="muted">{i + 1}</td>
                  <td>{d.name}</td>
                  <td>{d.leader || '—'}</td>
                  <td>{d.dept || '—'}</td>
                  <td>{d.category || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {drafts.length > 60 && <div className="muted">仅预览前 60 条，实际导入 {drafts.length} 条。</div>}
    </Modal>
  )
}
