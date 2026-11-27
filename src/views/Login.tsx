import { useEffect, useState } from 'react'
import { cloud } from '../cloud'
import { toast } from '../ui'

export default function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [tab, setTab] = useState<'phone' | 'wb'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  async function sendCode() {
    setErr('')
    if (!/^1\d{10}$/.test(phone)) {
      setErr('请输入正确的 11 位手机号')
      return
    }
    setBusy(true)
    try {
      const sent: any = await cloud.auth.sendOtp({ phone })
      if (sent.error) {
        setErr(sent.error.message || '验证码发送失败')
        return
      }
      setPending({ phone, ...sent.data })
      setCountdown(60)
      toast('验证码已提交发送，通常 10–30 秒内到达')
    } catch (e: any) {
      setErr(e?.message || '验证码发送失败')
    } finally {
      setBusy(false)
    }
  }

  async function submitPhone() {
    setErr('')
    if (!pending || pending.phone !== phone) {
      setErr('请先获取当前手机号的验证码')
      return
    }
    if (!code.trim()) {
      setErr('请输入验证码')
      return
    }
    setBusy(true)
    try {
      const res: any = await cloud.auth.verifyOtp({
        phone: pending.phone,
        verificationId: pending.verificationId,
        isExistingUser: pending.isExistingUser,
        token: code.trim(),
      })
      if (res.error) {
        setErr(res.error.message || '验证码校验失败')
        return
      }
      setPending(null)
      onSignedIn()
    } catch (e: any) {
      setErr(e?.message || '登录失败')
    } finally {
      setBusy(false)
    }
  }

  async function signInWorkBuddy() {
    setErr('')
    setBusy(true)
    try {
      const back = new URL(location.href)
      back.pathname = '/'
      for (const k of ['code', 'state', 'provider']) back.searchParams.delete(k)
      const res: any = await cloud.auth.signInWithOAuth({
        provider: 'workbuddy',
        redirectTo: back.toString(),
      })
      if (res.error) {
        setErr(res.error.message || 'WorkBuddy 登录发起失败')
        return
      }
      location.assign(res.data.url)
    } catch (e: any) {
      setErr(e?.message || 'WorkBuddy 登录发起失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>教务处项目管理平台</h1>
        <div className="sub">项目化课程 · 教学创新 · 其他项目 全流程管理</div>

        <div className="login-tabs">
          <button className={tab === 'phone' ? 'on' : ''} onClick={() => setTab('phone')}>
            手机号登录
          </button>
          <button className={tab === 'wb' ? 'on' : ''} onClick={() => setTab('wb')}>
            WorkBuddy 登录
          </button>
        </div>

        {tab === 'phone' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <label>手机号</label>
              <input
                type="text"
                value={phone}
                placeholder="请输入 11 位手机号"
                maxLength={11}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="field">
              <label>验证码</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={code}
                  placeholder="6 位短信验证码"
                  maxLength={6}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && submitPhone()}
                />
                <button className="btn" disabled={busy || countdown > 0} onClick={sendCode} style={{ whiteSpace: 'nowrap' }}>
                  {countdown > 0 ? `${countdown}s` : '获取验证码'}
                </button>
              </div>
            </div>
            <button className="btn primary" style={{ padding: '10px' }} disabled={busy} onClick={submitPhone}>
              {busy ? '登录中…' : '登 录'}
            </button>

            {pending && (
              <div
                className="muted"
                style={{
                  fontSize: 12,
                  lineHeight: 1.9,
                  background: '#f7f9fc',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '10px 12px',
                }}
              >
                <b>收不到验证码？</b>
                <br />
                ① 短信常会延迟 1–2 分钟，请耐心等待，不要连续点击「获取验证码」——频繁请求会被通道限流，反而更慢；
                <br />
                ② 检查手机是否设置了短信拦截，或看「骚扰拦截」文件夹；
                <br />
                ③ 确认手机号填写无误、当前信号正常；
                <br />
                ④ 多次尝试仍收不到，说明短信通道拥堵，请隔 10 分钟再试，或联系管理员登记。
              </div>
            )}
          </div>
        )}

        {tab === 'wb' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              使用 WorkBuddy 账号授权登录。该方式需要在已发布的正式域名下使用，本地预览不支持。
            </p>
            <button className="btn primary" style={{ padding: '10px' }} disabled={busy} onClick={signInWorkBuddy}>
              {busy ? '跳转中…' : '使用 WorkBuddy 登录'}
            </button>
          </div>
        )}

        {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 14 }}>{err}</div>}
      </div>
    </div>
  )
}
