import { useEffect, useState } from 'react'
import { fetchBlobByPath, triggerBlobDownload } from '../api'
import { cloud } from '../cloud'
import { Modal } from '../ui'

type Kind = 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'other'

function kindOf(name: string, mime?: string | null): Kind {
  const n = (name || '').toLowerCase()
  const m = mime || ''
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf'
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(n)) return 'image'
  if (m.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(n)) return 'video'
  if (m.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac)$/.test(n)) return 'audio'
  if (m.startsWith('text/') || /\.(txt|md|csv|log|json)$/.test(n)) return 'text'
  return 'other'
}

export default function AttachmentPreview({
  path,
  name,
  mime,
  onClose,
}: {
  path: string
  name: string
  mime?: string | null
  onClose: () => void
}) {
  const kind = kindOf(name, mime)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [blob, setBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [diag, setDiag] = useState('')
  const [diagBusy, setDiagBusy] = useState(false)

  async function runDiag() {
    setDiagBusy(true)
    const out: any = { path, size: blob?.size ?? null }
    try {
      const r: any = await cloud.storage.info(path)
      out.info = r?.error ? { error: r.error } : { size: r?.data?.size, contentType: r?.data?.contentType }
    } catch (e: any) {
      out.info = `抛错：${e?.message || e}`
    }
    try {
      const r: any = await cloud.storage.exists(path)
      out.exists = r?.error ?? r?.data ?? r
    } catch (e: any) {
      out.exists = `抛错：${e?.message || e}`
    }
    try {
      const r: any = await cloud.storage.download(path)
      out.download = {
        error: r?.error ?? null,
        dataType: r?.data ? Object.prototype.toString.call(r.data) : typeof r?.data,
      }
    } catch (e: any) {
      out.download = `抛错：${e?.message || e}`
    }
    try {
      const r: any = await cloud.storage.createSignedUrl(path, 60)
      out.signed = r?.error
        ? { error: r.error }
        : { urlLength: String(r?.data?.signedUrl || '').length }
    } catch (e: any) {
      out.signed = `抛错：${e?.message || e}`
    }
    setDiag(JSON.stringify(out, null, 2))
    setDiagBusy(false)
  }

  useEffect(() => {
    let alive = true
    let objUrl = ''
    setLoading(true)
    setErr('')
    ;(async () => {
      try {
        const b = await fetchBlobByPath(path)
        if (!alive) return
        setBlob(b)
        if (kind === 'text') {
          setText(await b.text())
        } else if (kind !== 'other') {
          objUrl = URL.createObjectURL(b)
          setUrl(objUrl)
        }
      } catch (e: any) {
        if (alive) {
          setErr(e?.message || '文件读取失败')
          // 失败时自动跑一次诊断，省去用户手动点击
          if (alive) runDiag()
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
      if (objUrl) URL.revokeObjectURL(objUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  function openNewTab() {
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <Modal
      title={`预览 · ${name}`}
      size="lg"
      onClose={onClose}
      footer={
        <>
          {url && (
            <button className="btn" onClick={openNewTab}>
              新窗口打开
            </button>
          )}
          <button
            className="btn primary"
            disabled={!blob}
            onClick={() => blob && triggerBlobDownload(blob, name)}
          >
            下载
          </button>
          <button className="btn" onClick={onClose}>
            关闭
          </button>
        </>
      }
    >
      {loading ? (
        <div className="loading" style={{ padding: 40 }}>
          正在加载文件…
        </div>
      ) : err ? (
        <div style={{ padding: 20 }}>
          <div style={{ color: 'var(--danger)', fontSize: 13, lineHeight: 1.9, wordBreak: 'break-word' }}>{err}</div>
          <p className="muted" style={{ fontSize: 13 }}>
            若持续失败，可点下方「诊断」把技术信息发给管理员。
          </p>
          <div style={{ marginTop: 10 }}>
            <button className="btn sm" onClick={runDiag} disabled={diagBusy}>
              {diagBusy ? '诊断中…' : '诊断'}
            </button>
          </div>
          {diag && (
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                fontSize: 12,
                lineHeight: 1.7,
                background: '#f6f8fb',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: 12,
                marginTop: 12,
                maxHeight: 320,
                overflow: 'auto',
              }}
            >
              {diag}
            </pre>
          )}
        </div>
      ) : kind === 'pdf' ? (
        <iframe
          src={url}
          title={name}
          style={{ width: '100%', height: '74vh', border: 'none', borderRadius: 4, background: '#f6f8fb' }}
        />
      ) : kind === 'image' ? (
        <div style={{ textAlign: 'center', background: '#f6f8fb', borderRadius: 4, padding: 8 }}>
          <img src={url} alt={name} style={{ maxWidth: '100%', maxHeight: '74vh', display: 'inline-block' }} />
        </div>
      ) : kind === 'video' ? (
        <video src={url} controls style={{ width: '100%', maxHeight: '74vh', background: '#000', borderRadius: 4 }} />
      ) : kind === 'audio' ? (
        <div style={{ padding: '30px 10px' }}>
          <audio src={url} controls style={{ width: '100%' }} />
        </div>
      ) : kind === 'text' ? (
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: 13,
            lineHeight: 1.8,
            background: '#f6f8fb',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: 14,
            maxHeight: '74vh',
            overflow: 'auto',
            margin: 0,
          }}
        >
          {text || '（空文件）'}
        </pre>
      ) : (
        <div style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
          <p className="muted" style={{ lineHeight: 1.9, fontSize: 13 }}>
            该格式（{name.split('.').pop()?.toUpperCase() || '未知'}）不支持在线预览。
            <br />
            请点击下方「下载」用本地软件打开。
          </p>
        </div>
      )}
    </Modal>
  )
}
