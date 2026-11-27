import { cloud } from './cloud'
import { getModule, safeSegment } from './modules'
import type {
  Attachment,
  CaseItem,
  ChangeLog,
  DeletionBackup,
  DictOption,
  Member,
  NodeRequest,
  Project,
  ProjectChange,
  ProjectNode,
  Textbook,
} from './types'

/* ---------------------------------- 会话 ---------------------------------- */

export async function getSession() {
  try {
    const { data, error } = await cloud.auth.getSession()
    if (error) return null
    return data
  } catch {
    return null
  }
}

export function onAuthChange(cb: (session: any) => void) {
  return cloud.auth.onAuthStateChange((_e: any, session: any) => cb(session))
}

export async function signOut() {
  await cloud.auth.signOut()
}

/* -------------------------------- 项目 projects ------------------------------- */

export async function listProjects(moduleKey?: string): Promise<Project[]> {
  let q = cloud.database.from('projects').select('*')
  if (moduleKey) q = q.eq('module_key', moduleKey)
  const { data, error } = await q.order('updated_at', { ascending: false })
  if (error) throw new Error(`项目数据读取失败：${(error as any)?.message || '权限或网络异常'}`)
  return (data || []) as Project[]
}

export async function getProject(id: number): Promise<Project | null> {
  const { data } = await cloud.database.from('projects').select('*').eq('id', id).maybeSingle()
  return (data || null) as Project | null
}

export async function createProject(payload: Partial<Project>): Promise<Project> {
  const { data, error } = await cloud.database.from('projects').insert(payload).select()
  if (error) throw error
  const row = (data || [])[0]
  if (!row) throw new Error('创建失败：没有返回数据，可能没有权限')
  return row as Project
}

export async function updateProject(id: number, patch: Partial<Project>): Promise<Project | null> {
  const { data, error } = await cloud.database
    .from('projects')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
  if (error) throw error
  const rows = (data || []) as Project[]
  if (!rows.length) throw new Error('没有更新到任何记录（可能不是你的项目）')
  return rows[0]
}

export async function deleteProject(id: number) {
  const { error } = await cloud.database.from('projects').delete().eq('id', id)
  if (error) throw error
}

/* --------------------------------- 节点 nodes -------------------------------- */

export async function listAllNodes(): Promise<ProjectNode[]> {
  const { data, error } = await cloud.database
    .from('project_nodes')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw new Error(`节点数据读取失败：${(error as any)?.message || '权限或网络异常'}`)
  return (data || []) as ProjectNode[]
}

export async function createNode(projectId: number, name: string, sortOrder: number): Promise<ProjectNode> {
  const { data, error } = await cloud.database
    .from('project_nodes')
    .insert({ project_id: projectId, name, sort_order: sortOrder, status: '未开始' })
    .select()
  if (error) throw error
  return (data || [])[0] as ProjectNode
}

export async function updateNode(id: number, patch: Partial<ProjectNode>): Promise<ProjectNode | null> {
  const { data, error } = await cloud.database
    .from('project_nodes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
  if (error) throw error
  return ((data || []) as ProjectNode[])[0] || null
}

export async function deleteNode(id: number) {
  const { error } = await cloud.database.from('project_nodes').delete().eq('id', id)
  if (error) throw error
}

/* -------------------------------- 附件 attachments ------------------------------- */

export async function listAllAttachments(): Promise<Attachment[]> {
  const { data, error } = await cloud.database
    .from('project_attachments')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`附件数据读取失败：${(error as any)?.message || '权限或网络异常'}`)
  return (data || []) as Attachment[]
}

function extOf(name: string) {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i) : ''
}

function baseOf(name: string) {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

/** 上传附件：对象存储路径 = 模块 / 项目 / 节点 / 文件名_v序号.扩展名 */
export async function uploadAttachment(
  project: Project,
  node: ProjectNode | null,
  file: File,
  remark?: string,
): Promise<Attachment> {
  const session = await getSession()
  const uid = session?.user?.id
  if (!uid) throw new Error('登录状态已失效，请重新登录')

  // 计算同名文件已有最大版本号
  let q = cloud.database
    .from('project_attachments')
    .select('version')
    .eq('project_id', project.id)
    .eq('file_name', file.name)
  if (node) q = q.eq('node_id', node.id)
  const { data: same } = await q
  const maxV = ((same || []) as any[]).reduce((m, r) => Math.max(m, r.version || 0), 0)
  const version = maxV + 1

  // 存储路径全部使用 ASCII 短标识：中文长文件名编码进 URL 后会超出网关限制，导致 502
  const ext = extOf(file.name)
  const shortName = `${Date.now().toString(36)}_v${version}${ext}`
  const rel = [
    `m-${project.module_key}`,
    `p-${project.id}`,
    node ? `n-${node.id}` : 'n-0',
    shortName,
  ].join('/')

  // 文件归属：优先落到课程负责人名下。这样管理员/审核人代传的材料，负责人也能读取。
  const ownerUid = project.contributor_uid || uid
  const path = cloud.storage.userPath(ownerUid, rel)
  const up = await cloud.storage.upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (up && (up as any).error) throw (up as any).error

  const { data, error } = await cloud.database
    .from('project_attachments')
    .insert({
      project_id: project.id,
      node_id: node ? node.id : null,
      file_name: file.name,
      display_name: file.name,
      storage_path: path,
      size: file.size,
      mime: file.type || null,
      version,
      remark: remark || null,
    })
    .select()
  if (error) {
    // 回滚已上传的文件
    await cloud.storage.remove([path])
    throw error
  }
  return (data || [])[0] as Attachment
}

export async function deleteAttachment(att: Attachment) {
  try {
    await cloud.storage.remove([att.storage_path])
  } catch {
    /* 文件可能已被移除，继续删记录 */
  }
  const { error } = await cloud.database.from('project_attachments').delete().eq('id', att.id)
  if (error) throw error
}

export async function updateAttachment(id: number, patch: Partial<Attachment>) {
  const { error } = await cloud.database.from('project_attachments').update(patch).eq('id', id)
  if (error) throw error
}

/** 取得带签名的临时下载地址 */
export async function getDownloadUrl(path: string): Promise<string> {
  const res: any = await cloud.storage.createSignedUrl(path, 600)
  if (res?.error) throw res.error
  const d = res?.data ?? res
  const url = d?.signedUrl || d?.signed_url || d?.url || d?.downloadUrl
  if (!url) throw new Error('无法生成下载地址')
  return url
}

export async function downloadAttachment(att: Attachment) {
  const blob = await fetchAttachmentBlob(att)
  triggerBlobDownload(blob, att.file_name)
}

/** 触发浏览器下载（blob 方式，不依赖签名地址） */
export function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 8000)
}

/**
 * 读取附件内容。
 * 双通道：先走 SDK 直接下载；失败再走签名地址 + fetch。
 * 两条都失败时，抛出合并后的原因，便于定位。
 */
export async function fetchAttachmentBlob(att: Attachment): Promise<Blob> {
  try {
    return await fetchBlobByPath(att.storage_path)
  } catch (e: any) {
    throw new Error(`读取「${att.file_name}」失败：${e?.message || e}`)
  }
}

/** 路径是否包含中文（旧版上传规则遗留，长中文路径会导致网关 502） */
export function pathHasCJK(path: string | null | undefined): boolean {
  return /[\u4e00-\u9fa5]/.test(String(path || ''))
}

/**
 * 把历史附件从「长中文路径」迁移到 ASCII 短路径。
 * 仅移动存储位置，附件记录 id、文件名、版本都不变。
 */
export async function relocateAttachment(att: Attachment): Promise<{ ok: boolean; message: string }> {
  const segs = String(att.storage_path || '').split('/')
  if (segs[0] !== 'users' || !segs[1]) {
    return { ok: false, message: '附件路径格式异常，无法自动迁移，请重新上传' }
  }
  const ownerUid = segs[1]
  const ext = extOf(att.file_name)
  const newPath = `users/${ownerUid}/p-${att.project_id}/n-${att.node_id || 0}/${Date.now().toString(36)}_v${att.version || 1}${ext}`

  try {
    const r: any = await cloud.storage.move(att.storage_path, newPath)
    if (r?.error) throw r.error
  } catch (e: any) {
    return { ok: false, message: `迁移失败：${e?.message || e}。可尝试重新上传该文件` }
  }

  await updateAttachment(att.id, { storage_path: newPath })
  return { ok: true, message: '已迁移到新路径，现在可以正常预览与下载' }
}

/** 按任意 storage 路径取内容（教材合同等不在附件表里的文件用） */
export async function fetchBlobByPath(path: string): Promise<Blob> {
  const errs: string[] = []

  // 通道一：SDK 直接下载
  try {
    const res: any = await cloud.storage.download(path)
    if (!res?.error) {
      const blob = res?.data ?? res
      if (blob instanceof Blob) return blob
      errs.push('直取通道返回内容异常')
    } else {
      const m = (res.error as any)?.message || JSON.stringify(res.error).slice(0, 160)
      errs.push(`直取通道：${m}`)
    }
  } catch (e: any) {
    errs.push(`直取通道：${e?.message || e}`)
  }

  // 通道二：签名地址 + fetch
  try {
    const res: any = await cloud.storage.createSignedUrl(path, 600)
    if (res?.error) throw res.error
    const d = res?.data ?? res
    const url = d?.signedUrl || d?.signed_url || d?.url
    if (!url) throw new Error('未返回签名地址')
    const r = await fetch(url)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return await r.blob()
  } catch (e: any) {
    errs.push(`签名通道：${e?.message || e}`)
  }

  throw new Error(errs.join('；'))
}

/* --------------------------------- 数据字典 dict -------------------------------- */

export async function listDict(): Promise<DictOption[]> {
  const { data } = await cloud.database.from('dict_options').select('*').order('sort_order', { ascending: true })
  return (data || []) as DictOption[]
}

export async function addDict(kind: string, value: string, moduleKey?: string | null, sortOrder = 0) {
  const { error } = await cloud.database
    .from('dict_options')
    .insert({ kind, value, module_key: moduleKey || null, sort_order: sortOrder })
  if (error) throw error
}

export async function deleteDict(id: number) {
  const { error } = await cloud.database.from('dict_options').delete().eq('id', id)
  if (error) throw error
}

/* --------------------------------- 变更记录 log -------------------------------- */

export async function addLog(projectId: number | null, action: string, detail?: string) {
  try {
    await cloud.database.from('change_logs').insert({ project_id: projectId, action, detail: detail || null })
  } catch {
    /* 日志失败不影响主流程 */
  }
}

export async function listLogs(projectId?: number): Promise<ChangeLog[]> {
  let q = cloud.database.from('change_logs').select('*')
  if (projectId) q = q.eq('project_id', projectId)
  const { data } = await q.order('created_at', { ascending: false }).limit(200)
  return (data || []) as ChangeLog[]
}

/* --------------------------------- 成员 members -------------------------------- */

export async function listMembers(): Promise<Member[]> {
  const { data } = await cloud.database.from('members').select('*').order('id', { ascending: true })
  return (data || []) as Member[]
}

export async function createMember(payload: Partial<Member>) {
  const { data, error } = await cloud.database.from('members').insert(payload).select()
  if (error) throw error
  return (data || [])[0] as Member
}

export async function updateMember(id: number, patch: Partial<Member>) {
  const { data, error } = await cloud.database.from('members').update(patch).eq('id', id).select()
  if (error) throw error
  return ((data || []) as Member[])[0] || null
}

export async function deleteMember(id: number) {
  const { error } = await cloud.database.from('members').delete().eq('id', id)
  if (error) throw error
}

/* --------------------------------- 教材 textbooks -------------------------------- */

export const TEXTBOOK_PREFIX = 'XMHKC202601'

/** 生成下一个课程项目编号：XMHKC{批次年月}{3位流水} */
export async function nextProjectCode(prefix = TEXTBOOK_PREFIX): Promise<string> {
  const { data } = await cloud.database
    .from('projects')
    .select('code')
    .like('code', `${prefix}%`)
    .order('code', { ascending: false })
    .limit(1)
  const last = (data || [])[0]?.code as string | undefined
  const n = last ? parseInt(last.slice(prefix.length), 10) + 1 : 1
  return prefix + String(isNaN(n) ? 1 : n).padStart(3, '0')
}

export async function listTextbooks(): Promise<Textbook[]> {
  const { data } = await cloud.database
    .from('textbooks')
    .select('*')
    .order('updated_at', { ascending: false })
  return (data || []) as Textbook[]
}

export async function createTextbook(payload: Partial<Textbook>) {
  const { data, error } = await cloud.database.from('textbooks').insert(payload).select()
  if (error) throw error
  return (data || [])[0] as Textbook
}

export async function updateTextbook(id: number, patch: Partial<Textbook>) {
  const { data, error } = await cloud.database
    .from('textbooks')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
  if (error) throw error
  return ((data || []) as Textbook[])[0] || null
}

export async function deleteTextbook(id: number, contractPath?: string | null) {
  if (contractPath) {
    try {
      await cloud.storage.remove([contractPath])
    } catch {
      /* 文件可能已不存在 */
    }
  }
  const { error } = await cloud.database.from('textbooks').delete().eq('id', id)
  if (error) throw error
}

/** 上传出版合同，路径：教材/课程编号-课程名/文件名 */
export async function uploadContract(
  tb: Pick<Textbook, 'project_code' | 'name'>,
  file: File,
): Promise<{ contract_name: string; contract_path: string }> {
  const session = await getSession()
  const uid = session?.user?.id
  if (!uid) throw new Error('登录状态已失效，请重新登录')

  const folder = safeSegment(`${tb.project_code || '未编号'}-${tb.name || '教材'}`)
  const path = cloud.storage.userPath(uid, `教材/${folder}/${safeSegment(file.name)}`)
  const up = await cloud.storage.upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: true,
  })
  if (up && (up as any).error) throw (up as any).error
  return { contract_name: file.name, contract_path: path }
}

/* --------------------------------- 变更申请 node_requests -------------------------------- */

export async function listNodeRequests(nodeId: number): Promise<NodeRequest[]> {
  const { data } = await cloud.database
    .from('node_requests')
    .select('*')
    .eq('node_id', nodeId)
    .order('id', { ascending: false })
  return (data || []) as NodeRequest[]
}

export async function createNodeRequest(payload: Partial<NodeRequest>) {
  const { data, error } = await cloud.database.from('node_requests').insert(payload).select()
  if (error) throw error
  return (data || [])[0] as NodeRequest
}

export async function updateNodeRequest(id: number, patch: Partial<NodeRequest>) {
  const { data, error } = await cloud.database.from('node_requests').update(patch).eq('id', id).select()
  if (error) throw error
  return ((data || []) as NodeRequest[])[0] || null
}

/* --------------------------------- 变更申请 project_changes -------------------------------- */

export async function listProjectChanges(projectId: number): Promise<ProjectChange[]> {
  const { data, error } = await cloud.database
    .from('project_changes')
    .select('*')
    .eq('project_id', projectId)
    .order('id', { ascending: false })
  if (error) throw new Error(`变更记录读取失败：${(error as any)?.message || ''}`)
  return (data || []) as ProjectChange[]
}

export async function createProjectChange(payload: Partial<ProjectChange>) {
  const { data, error } = await cloud.database.from('project_changes').insert(payload).select()
  if (error) throw error
  return (data || [])[0] as ProjectChange
}

export async function updateProjectChange(id: number, patch: Partial<ProjectChange>) {
  const { data, error } = await cloud.database.from('project_changes').update(patch).eq('id', id).select()
  if (error) throw error
  return ((data || []) as ProjectChange[])[0] || null
}

/* --------------------------------- 删除备份 deletion_backups -------------------------------- */

export async function createBackup(payload: Partial<DeletionBackup>): Promise<DeletionBackup> {
  const { data, error } = await cloud.database.from('deletion_backups').insert(payload).select()
  if (error) throw error
  return (data || [])[0] as DeletionBackup
}

export async function listBackups(limit = 200): Promise<DeletionBackup[]> {
  const { data, error } = await cloud.database
    .from('deletion_backups')
    .select('*')
    .order('id', { ascending: false })
    .limit(limit)
  if (error) return []
  return (data || []) as DeletionBackup[]
}

export async function updateBackup(id: number, patch: Partial<DeletionBackup>) {
  const { error } = await cloud.database.from('deletion_backups').update(patch).eq('id', id)
  if (error) throw error
}

/** 从备份恢复课程（含节点与附件记录） */
export async function restoreProjectFromBackup(bk: DeletionBackup): Promise<{ ok: boolean; message: string }> {
  const p = bk.payload?.project
  if (!p) return { ok: false, message: '备份内容不完整，无法恢复' }

  const { id: _pid, created_at: _pc, updated_at: _pu, ...prest } = p
  const { data, error } = await cloud.database.from('projects').insert(prest).select()
  if (error) return { ok: false, message: `恢复失败：${(error as any)?.message || ''}` }
  const newId = (data || [])[0]?.id
  if (!newId) return { ok: false, message: '恢复失败：未返回新记录' }

  const idMap = new Map<number, number>()
  for (const n of bk.payload?.nodes || []) {
    const { id: _nid, created_at: _nc, updated_at: _nu, ...nrest } = n
    const r = await cloud.database.from('project_nodes').insert({ ...nrest, project_id: newId }).select()
    if (!r.error && r.data?.[0]?.id) idMap.set(n.id, r.data[0].id)
  }

  let restoredFiles = 0
  for (const a of bk.payload?.attachments || []) {
    const { id: _aid, created_at: _ac, ...arest } = a
    const r = await cloud.database
      .from('project_attachments')
      .insert({
        ...arest,
        project_id: newId,
        node_id: a.node_id ? idMap.get(a.node_id) ?? null : null,
      })
      .select()
    if (!r.error) restoredFiles++
  }

  await updateBackup(bk.id, {
    status: 'restored',
    note: `已恢复为课程 id=${newId}，节点 ${idMap.size} 个、附件记录 ${restoredFiles} 条（附件文件若已清理需重新上传）`,
  })
  return {
    ok: true,
    message: `已恢复为课程 id=${newId}，节点 ${idMap.size} 个、附件记录 ${restoredFiles} 条。附件原始文件不在备份内，如已删除需重新上传。`,
  }
}

/* --------------------------------- 案例 cases -------------------------------- */

export async function listCases(): Promise<CaseItem[]> {
  const { data } = await cloud.database.from('cases').select('*').order('updated_at', { ascending: false })
  return (data || []) as CaseItem[]
}

export async function createCase(payload: Partial<CaseItem>) {
  const { data, error } = await cloud.database.from('cases').insert(payload).select()
  if (error) throw error
  return (data || [])[0] as CaseItem
}

export async function updateCase(id: number, patch: Partial<CaseItem>) {
  const { data, error } = await cloud.database
    .from('cases')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
  if (error) throw error
  return ((data || []) as CaseItem[])[0] || null
}

export async function deleteCase(id: number) {
  const { error } = await cloud.database.from('cases').delete().eq('id', id)
  if (error) throw error
}
