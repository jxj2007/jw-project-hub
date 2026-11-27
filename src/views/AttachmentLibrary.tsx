import { useMemo, useState } from 'react'
import { MODULES, getModule } from '../modules'
import { fmtSize, fmtTime } from '../export'
import { deleteAttachment, downloadAttachment } from '../api'
import AttachmentPreview from '../components/AttachmentPreview'
import { toast } from '../ui'
import type { Attachment, Project, ProjectNode } from '../types'

type Sel = { level: 'all' | 'module' | 'project' | 'node'; moduleKey?: string; projectId?: number; nodeId?: number }

export default function AttachmentLibrary({
  projects,
  nodes,
  attachments,
  onOpen,
  onReload,
}: {
  projects: Project[]
  nodes: ProjectNode[]
  attachments: Attachment[]
  onOpen: (id: number) => void
  onReload: () => void
}) {
  const [sel, setSel] = useState<Sel>({ level: 'all' })
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<Attachment | null>(null)

  const projById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  const toggle = (k: string) => {
    setOpen((s) => {
      const n = new Set(s)
      n.has(k) ? n.delete(k) : n.add(k)
      return n
    })
  }

  const countByProject = (pid: number) => attachments.filter((a) => a.project_id === pid).length
  const countByModule = (mk: string) => attachments.filter((a) => projById.get(a.project_id)?.module_key === mk).length

  const list = useMemo(() => {
    return attachments.filter((a) => {
      const p = projById.get(a.project_id)
      if (!p) return false
      if (sel.level === 'module') return p.module_key === sel.moduleKey
      if (sel.level === 'project') return a.project_id === sel.projectId
      if (sel.level === 'node') return a.node_id === sel.nodeId
      return true
    })
  }, [attachments, sel, projById])

  async function remove(a: Attachment) {
    if (!confirm(`确定删除「${a.file_name}」？云端文件将一并删除。`)) return
    try {
      await deleteAttachment(a)
      toast('已删除')
      onReload()
    } catch (e: any) {
      toast(e?.message || '删除失败', 'err')
    }
  }

  const selTitle =
    sel.level === 'all'
      ? '全部附件'
      : sel.level === 'module'
        ? getModule(sel.moduleKey!).name
        : sel.level === 'project'
          ? projById.get(sel.projectId!)?.name || ''
          : nodeById.get(sel.nodeId!)?.name || ''

  return (
    <div className="lib">
      <div className="lib-tree">
        <div
          className={`tree-row ${sel.level === 'all' ? 'on' : ''}`}
          onClick={() => setSel({ level: 'all' })}
        >
          📚 全部附件<span className="cnt">{attachments.length}</span>
        </div>

        {MODULES.map((m) => {
          const ps = projects.filter((p) => p.module_key === m.key)
          const isOpen = open.has(m.key)
          return (
            <div className="tree-node" key={m.key}>
              <div
                className={`tree-row ${sel.level === 'module' && sel.moduleKey === m.key ? 'on' : ''}`}
                onClick={() => {
                  toggle(m.key)
                  setSel({ level: 'module', moduleKey: m.key })
                }}
              >
                <span style={{ width: 12 }}>{isOpen ? '▾' : '▸'}</span>
                {m.icon} {m.short}
                <span className="cnt">{countByModule(m.key)}</span>
              </div>
              {isOpen && (
                <div className="tree-children">
                  {ps.length === 0 && <div className="tree-row muted">暂无{m.itemLabel}</div>}
                  {ps.map((p) => {
                    const nk = `p-${p.id}`
                    const pOpen = open.has(nk)
                    const pNodes = nodes.filter((n) => n.project_id === p.id).sort((a, b) => a.sort_order - b.sort_order)
                    return (
                      <div className="tree-node" key={p.id}>
                        <div
                          className={`tree-row ${sel.level === 'project' && sel.projectId === p.id ? 'on' : ''}`}
                          onClick={() => {
                            toggle(nk)
                            setSel({ level: 'project', projectId: p.id })
                          }}
                        >
                          <span style={{ width: 12 }}>{pOpen ? '▾' : '▸'}</span>
                          {p.name}
                          <span className="cnt">{countByProject(p.id)}</span>
                        </div>
                        {pOpen && (
                          <div className="tree-children">
                            {pNodes.map((n) => {
                              const c = attachments.filter((a) => a.node_id === n.id).length
                              return (
                                <div
                                  key={n.id}
                                  className={`tree-row ${sel.level === 'node' && sel.nodeId === n.id ? 'on' : ''}`}
                                  onClick={() => setSel({ level: 'node', nodeId: n.id })}
                                >
                                  📄 {n.name}
                                  <span className="cnt">{c}</span>
                                </div>
                              )
                            })}
                            {pNodes.length === 0 && <div className="tree-row muted">无节点</div>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="lib-main">
        <div className="card">
          <h3>
            {selTitle}（{list.length} 份）
          </h3>
          {sel.level === 'project' && (
            <div className="path-eg" style={{ marginBottom: 12 }}>
              该{getModule(projById.get(sel.projectId!)?.module_key || 'three100').itemLabel}的全部材料按节点分目录存放
            </div>
          )}
          {list.length === 0 ? (
            <div className="empty">这里还没有材料。</div>
          ) : (
            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th>文件名</th>
                    <th style={{ width: 200 }}>所属{sel.level === 'node' ? '节点' : '项目 / 节点'}</th>
                    <th style={{ width: 70 }} className="num">
                      版本
                    </th>
                    <th style={{ width: 90 }} className="num">
                      大小
                    </th>
                    <th style={{ width: 150 }}>上传时间</th>
                    <th style={{ width: 130 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => {
                    const p = projById.get(a.project_id)
                    const n = a.node_id ? nodeById.get(a.node_id) : null
                    return (
                      <tr key={a.id}>
                        <td style={{ wordBreak: 'break-all' }}>{a.file_name}</td>
                        <td>
                          {sel.level === 'node' ? (
                            n?.name || '未分类'
                          ) : (
                            <>
                              <button
                                className="btn ghost"
                                style={{ padding: 0 }}
                                onClick={() => p && onOpen(p.id)}
                              >
                                {p?.name}
                              </button>
                              <div className="muted">{n?.name || '未分类'}</div>
                            </>
                          )}
                        </td>
                        <td className="num">v{a.version}</td>
                        <td className="num">{fmtSize(a.size)}</td>
                        <td className="nowrap">{fmtTime(a.created_at)}</td>
                        <td className="nowrap">
                          <button className="btn sm primary" onClick={() => setPreview(a)}>
                            预览
                          </button>{' '}
                          <button
                            className="btn sm"
                            onClick={() =>
                              downloadAttachment(a).catch((e) => toast(e?.message || '下载失败', 'err'))
                            }
                          >
                            下载
                          </button>{' '}
                          <button className="btn sm danger" onClick={() => remove(a)}>
                            删除
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
      </div>

      {preview && (
        <AttachmentPreview
          path={preview.storage_path}
          name={preview.file_name}
          mime={preview.mime}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}
