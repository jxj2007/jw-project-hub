import { Component } from 'react'
import type { ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * 页面级错误边界：任何子组件渲染异常时，不再整页白屏，
 * 而是把错误信息显示出来，便于定位。
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: any) {
    // eslint-disable-next-line no-console
    console.error('[页面渲染出错]', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card">
          <h3>这个模块加载出错了</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            请把下面这段提示发给我，用于定位问题。其他模块不受影响，可先切换左侧菜单继续使用。
          </p>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontSize: 12,
              lineHeight: 1.7,
              background: '#f6f8fb',
              border: '1px solid var(--border)',
              padding: '10px 12px',
              borderRadius: 4,
              color: '#b03a2e',
              maxHeight: 260,
              overflow: 'auto',
            }}
          >
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <div style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={() => this.setState({ error: null })}>
              重试
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
