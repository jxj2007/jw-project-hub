import { useEffect, useState } from 'react'
import { cloud } from './cloud'
import { getSession, listAllAttachments, listAllNodes, listMembers, listProjects, signOut } from './api'
import { bindMember, loadPerm } from './auth'
import { MODULES } from './modules'
import type { Attachment, Member, Perm, Project, ProjectNode } from './types'
import Login from './views/Login'
import Dashboard from './views/Dashboard'
import ProjectList from './views/ProjectList'
import ProjectDetail from './views/ProjectDetail'
import AttachmentLibrary from './views/AttachmentLibrary'
import Textbooks from './views/Textbooks'
import Cases from './views/Cases'
import Members from './views/Members'
import Settings from './views/Settings'
import ErrorBoundary from './ErrorBoundary'
import { ToastHost, toast } from './ui'

export type View =
  | { name: 'dashboard' }
  | { name: 'projects'; moduleKey: string }
  | { name: 'detail'; projectId: number; from: string }
  | { name: 'library' }
  | { name: 'textbooks' }
  | { name: 'cases' }
  | { name: 'members' }
  | { name: 'settings' }

const EMPTY_PERM: Perm = {
  member: null,
  isAdmin: false,
  canSubmit: false,
  canReview: false,
  allowed: false,
  loading: true,
  reload: async () => {},
}

export default function App() {
  const [booting, setBooting] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [authErr, setAuthErr] = useState('')
  const [view, setView] = useState<View>({ name: 'dashboard' })
  const [projects, setProjects] = useState<Project[]>([])
  const [nodes, setNodes] = useState<ProjectNode[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [perm, setPerm] = useState<Perm>(EMPTY_PERM)
  const [loading, setLoading] = useState(false)
  const [bindPhone, setBindPhone] = useState('')
  const [bindMsg, setBindMsg] = useState('')
  const [binding, setBinding] = useState(false)

  useEffect(() => {
    boot()
  }, [])

  async function boot() {
    try {
      const url = new URL(location.href)
      if (url.searchParams.has('code') || url.searchParams.has('error')) {
        const provider = url.searchParams.get('provider')
        const handler =
          provider === 'workbuddy'
            ? (cloud.auth as any).handleWorkBuddyCallback
            : provider === 'wechat'
              ? (cloud.auth as any).handleWechatWebCallback
              : null
        if (!handler) {
          setAuthErr('授权回调缺少有效的登录方式，请重新登录。')
          setBooting(false)
          return
        }
        const res: any = await handler.call(cloud.auth)
        if (res?.error) {
          setAuthErr(res.error.message || '登录失败')
        } else if (res?.data) {
          for (const k of ['code', 'state', 'provider']) url.searchParams.delete(k)
          history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
          setSession(res.data)
          setBooting(false)
          await afterLogin(res.data)
          return
        }
      }
      const s = await getSession()
      setSession(s)
      setBooting(false)
      if (s) await afterLogin(s)
    } catch (e: any) {
      setAuthErr(e?.message || '启动失败')
      setBooting(false)
    }
  }

  async function afterLogin(s: any) {
    const p = await loadPerm(s)
    setPerm({ ...p, loading: false, reload: refreshPerm })
    if (p.allowed) {
      await loadAll()
      const ms = await listMembers().catch(() => [] as Member[])
      setMembers(ms)
    }
  }

  async function refreshPerm() {
    const p = await loadPerm(session)
    setPerm({ ...p, loading: false, reload: refreshPerm })
    const ms = await listMembers().catch(() => [] as Member[])
    setMembers(ms)
    // 权限变化（如刚绑定账号）后必须重新拉数据，否则界面进去了但列表是空的
    if (p.allowed) await loadAll()
  }

  async function loadAll() {
    setLoading(true)
    try {
      const [pr, nr, ar] = await Promise.allSettled([
        listProjects(),
        listAllNodes(),
        listAllAttachments(),
      ])
      const errs: string[] = []
      if (pr.status === 'fulfilled') setProjects(pr.value)
      else errs.push(`课程：${pr.reason?.message || pr.reason}`)
      if (nr.status === 'fulfilled') setNodes(nr.value)
      else errs.push(`节点：${nr.reason?.message || nr.reason}`)
      if (ar.status === 'fulfilled') setAttachments(ar.value)
      else errs.push(`附件：${ar.reason?.message || ar.reason}`)
      if (errs.length) toast(errs.join('；'), 'err')
    } catch (e: any) {
      toast(e?.message || '数据加载失败', 'err')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    setSession(null)
    setPerm(EMPTY_PERM)
    setProjects([])
    setNodes([])
    setAttachments([])
    setMembers([])
    setView({ name: 'dashboard' })
  }

  if (booting) return <div className="loading">正在加载…</div>

  if (authErr) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>登录遇到问题</h1>
          <p style={{ color: 'var(--danger)', fontSize: 13, lineHeight: 1.7 }}>{authErr}</p>
          <button className="btn primary" onClick={() => location.reload()}>
            重新登录
          </button>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <>
        <Login onSignedIn={() => boot()} />
        <ToastHost />
      </>
    )
  }

  if (perm.loading) return <div className="loading">正在校验身份权限…</div>

  if (!perm.allowed) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>账号未绑定</h1>
          <p className="muted" style={{ lineHeight: 1.9, fontSize: 13 }}>
            你的登录账号还没与人员名单对应上。
            <br />
            请输入管理员添加你时登记的<span style={{ color: 'var(--text)' }}>手机号</span>完成绑定。
          </p>

          <div className="field" style={{ marginTop: 14 }}>
            <label>手机号</label>
            <input
              value={bindPhone}
              maxLength={11}
              placeholder="管理员登记的手机号"
              onChange={(e) => setBindPhone(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const btn = document.getElementById('bind-btn')
                  btn?.click()
                }
              }}
            />
          </div>

          {bindMsg && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{bindMsg}</div>}

          <div className="row" style={{ marginTop: 16 }}>
            <button
              id="bind-btn"
              className="btn primary"
              disabled={binding}
              onClick={async () => {
                setBindMsg('')
                setBinding(true)
                try {
                  const r = await bindMember(
                    bindPhone,
                    String(session?.user?.id ?? ''),
                    perm.members || [],
                  )
                  if (!r.ok) {
                    setBindMsg(r.message)
                    return
                  }
                  await refreshPerm()
                  toast('绑定成功，欢迎回来')
                } catch (e: any) {
                  setBindMsg(e?.message || '绑定失败，请重试')
                } finally {
                  setBinding(false)
                }
              }}
            >
              {binding ? '绑定中…' : '绑定并登录'}
            </button>
            <button className="btn" onClick={handleSignOut}>
              退出登录
            </button>
          </div>

          <p className="muted" style={{ fontSize: 12, marginTop: 16, lineHeight: 1.7 }}>
            若提示“手机号未登记”，说明管理员还没把你加入名单；若提示“已绑定其他账号”，请联系管理员解绑。
          </p>
        </div>
        <ToastHost />
      </div>
    )
  }

  const title =
    view.name === 'dashboard'
      ? '工作台'
      : view.name === 'library'
        ? '附件库'
        : view.name === 'textbooks'
          ? '教材管理'
          : view.name === 'cases'
            ? '案例库'
            : view.name === 'members'
            ? '成员与权限'
            : view.name === 'settings'
              ? '系统设置'
              : view.name === 'projects'
                ? MODULES.find((m) => m.key === view.moduleKey)?.name || '项目管理'
                : '详情'

  const countOf = (k: string) => projects.filter((p) => p.module_key === k).length
  const backToList = (from: string) =>
    setView(from === 'library' ? { name: 'library' } : { name: 'projects', moduleKey: from || 'three100' })

  return (
    <>
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            教务处项目管理平台
            <span>
              {perm.member?.name || ''}
              {perm.isAdmin ? ' · 管理员' : perm.canReview ? ' · 审核' : ' · 填报'}
            </span>
          </div>
          <nav className="nav">
            <button className={view.name === 'dashboard' ? 'on' : ''} onClick={() => setView({ name: 'dashboard' })}>
              <span>🏠</span> 工作台
            </button>
            <div className="nav-group">项目建设</div>
            {MODULES.map((m) => (
              <button
                key={m.key}
                className={view.name === 'projects' && view.moduleKey === m.key ? 'on' : ''}
                onClick={() => setView({ name: 'projects', moduleKey: m.key })}
              >
                <span>{m.icon}</span> {m.short}
                <span className="badge">{countOf(m.key)}</span>
              </button>
            ))}
            <div className="nav-group">成果</div>
            <button className={view.name === 'textbooks' ? 'on' : ''} onClick={() => setView({ name: 'textbooks' })}>
              <span>📕</span> 教材管理
            </button>
            <button className={view.name === 'cases' ? 'on' : ''} onClick={() => setView({ name: 'cases' })}>
              <span>📋</span> 案例库
            </button>
            <button className={view.name === 'library' ? 'on' : ''} onClick={() => setView({ name: 'library' })}>
              <span>📁</span> 附件库
              <span className="badge">{attachments.length}</span>
            </button>
            <div className="nav-group">系统</div>
            {(perm.isAdmin || perm.canReview) && (
              <button className={view.name === 'members' ? 'on' : ''} onClick={() => setView({ name: 'members' })}>
                <span>👥</span> 成员与权限
                <span className="badge">{members.length}</span>
              </button>
            )}            <button className={view.name === 'settings' ? 'on' : ''} onClick={() => setView({ name: 'settings' })}>
              <span>⚙️</span> 系统设置
            </button>
          </nav>
          <div className="foot">
            {perm.member?.name || '已登录'}
            <br />
            <button onClick={handleSignOut}>退出登录</button>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            {view.name === 'detail' && (
              <button className="btn ghost" onClick={() => backToList(view.from)}>
                ← 返回
              </button>
            )}
            <h2>{title}</h2>
            <div className="spacer" />
            {loading && <span className="muted">同步中…</span>}
            <button className="btn sm" onClick={loadAll} disabled={loading}>
              刷新数据
            </button>
          </header>

          <main className="content">
            <ErrorBoundary key={JSON.stringify(view)}>
            {view.name === 'dashboard' && (
              <Dashboard
                projects={projects}
                nodes={nodes}
                attachments={attachments}
                perm={perm}
                onOpen={(id, from) => setView({ name: 'detail', projectId: id, from })}
                onGoModule={(k) => setView({ name: 'projects', moduleKey: k })}
              />
            )}
            {view.name === 'projects' && (
              <ProjectList
                moduleKey={view.moduleKey}
                projects={projects}
                nodes={nodes}
                attachments={attachments}
                perm={perm}
                onOpen={(id) => setView({ name: 'detail', projectId: id, from: view.moduleKey })}
                onReload={loadAll}
              />
            )}
            {view.name === 'detail' && (
              <ProjectDetail
                projectId={view.projectId}
                projects={projects}
                nodes={nodes}
                attachments={attachments}
                perm={perm}
                onReload={loadAll}
                onBack={() => backToList(view.from)}
              />
            )}
            {view.name === 'textbooks' && (
              <Textbooks
                projects={projects}
                perm={perm}
                onOpenProject={(id) => setView({ name: 'detail', projectId: id, from: 'three100' })}
              />
            )}
            {view.name === 'cases' && (
              <Cases
                projects={projects}
                perm={perm}
                onOpenProject={(id) => setView({ name: 'detail', projectId: id, from: 'three100' })}
              />
            )}
            {view.name === 'library' && (
              <AttachmentLibrary
                projects={projects}
                nodes={nodes}
                attachments={attachments}
                onOpen={(id) => setView({ name: 'detail', projectId: id, from: 'library' })}
                onReload={loadAll}
              />
            )}
            {view.name === 'members' && (
              <Members
                members={members}
                meId={session?.user?.id ? String(session.user.id) : null}
                canEdit={perm.isAdmin || perm.canReview}
                projects={projects}
                onReload={refreshPerm}
              />
            )}
            {view.name === 'settings' && (
              <Settings projects={projects} nodes={nodes} attachments={attachments} onReload={loadAll} />
            )}
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <ToastHost />
    </>
  )
}
