import type { ProjectNode } from '../types'

/** 节点状态对应的完成比例 */
export const NODE_PCT: Record<string, number> = {
  未开始: 0,
  进行中: 25,
  需整改: 50,
  已提交: 75,
  已通过: 100,
}

const COLOR: Record<string, string> = {
  未开始: '#cbd5e1',
  进行中: '#3b82f6',
  需整改: '#f59e0b',
  已提交: '#6366f1',
  已通过: '#10b981',
}

export function pctOf(status: string): number {
  return NODE_PCT[status] ?? 0
}

export function overallPct(nodes: ProjectNode[]): number {
  if (!nodes.length) return 0
  const sum = nodes.reduce((s, n) => s + pctOf(n.status), 0)
  return Math.round(sum / nodes.length)
}

export function Bar({ pct, color, height = 8 }: { pct: number; color: string; height?: number }) {
  return (
    <div
      style={{
        background: '#eef2f7',
        borderRadius: 999,
        height,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <div
        style={{
          width: `${Math.max(0, Math.min(100, pct))}%`,
          height: '100%',
          background: color,
          borderRadius: 999,
          transition: 'width .35s ease',
        }}
      />
    </div>
  )
}

/** 列表页用的紧凑进度：一根总条 + 百分比 */
export function MiniProgress({ nodes }: { nodes: ProjectNode[] }) {
  const pct = overallPct(nodes)
  const color = pct === 100 ? '#10b981' : nodes.length ? '#3b82f6' : '#cbd5e1'
  return (
    <div style={{ minWidth: 90 }}>
      <Bar pct={pct} color={color} height={6} />
      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
        {nodes.length ? `${nodes.filter((n) => n.status === '已通过').length}/${nodes.length} 环节 · ${pct}%` : '—'}
      </div>
    </div>
  )
}

/** 详情页用的完整进度面板：整体 + 每个环节独立进度条 */
export function ProgressPanel({ nodes }: { nodes: ProjectNode[] }) {
  const pct = overallPct(nodes)
  const done = nodes.filter((n) => n.status === '已通过').length

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>填报进度</h3>
        <div style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 13 }}>
          已通过 {done}/{nodes.length} 个环节 · 整体 {pct}%
        </span>
      </div>

      {nodes.length === 0 ? (
        <div className="empty">暂无节点</div>
      ) : (
        nodes.map((n) => {
          const p = pctOf(n.status)
          return (
            <div key={n.id} style={{ marginBottom: 14 }}>
              <div
                className="row"
                style={{ justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}
              >
                <span style={{ fontWeight: 500 }}>{n.name}</span>
                <span className="muted">
                  <span
                    className={`tag ${
                      n.status === '已通过'
                        ? 'ok'
                        : n.status === '需整改'
                          ? 'danger'
                          : n.status === '已提交'
                            ? 'info'
                            : ''
                    }`}
                    style={{ marginRight: 8 }}
                  >
                    {n.status}
                  </span>
                  {p}%
                </span>
              </div>
              <Bar pct={p} color={COLOR[n.status] || '#cbd5e1'} />
            </div>
          )
        })
      )}
    </div>
  )
}
