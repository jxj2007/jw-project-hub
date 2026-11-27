import { useMemo } from 'react'
import { MODULES, getModule } from '../modules'
import { downloadCsv } from '../export'
import BackupPanel from '../components/BackupPanel'
import type { Attachment, Project, ProjectNode } from '../types'

export default function Settings({
  projects,
  nodes,
  attachments,
}: {
  projects: Project[]
  nodes: ProjectNode[]
  attachments: Attachment[]
  onReload: () => void
}) {
  const stat = useMemo(() => {
    return MODULES.map((m) => {
      const ps = projects.filter((p) => p.module_key === m.key)
      const ids = new Set(ps.map((p) => p.id))
      return {
        m,
        projects: ps.length,
        nodes: nodes.filter((n) => ids.has(n.project_id)).length,
        files: attachments.filter((a) => ids.has(a.project_id)).length,
      }
    })
  }, [projects, nodes, attachments])

  function exportAll() {
    const head = [
      '模块',
      '名称',
      '编号',
      '负责人',
      '院部',
      '类别',
      '级别',
      '立项年度',
      '建设周期',
      '经费(万元)',
      '状态',
      '节点',
      '节点状态',
      '应完成',
      '实际提交',
      '附件数',
    ]
    const rows: any[][] = []
    for (const p of projects) {
      const ns = nodes.filter((n) => n.project_id === p.id)
      if (ns.length === 0) {
        rows.push([getModule(p.module_key).name, p.name, p.code, p.leader, p.dept, p.category, p.level, p.year, '', p.funding, p.status, '', '', '', '', 0])
      }
      for (const n of ns) {
        rows.push([
          getModule(p.module_key).name,
          p.name,
          p.code,
          p.leader,
          p.dept,
          p.category,
          p.level,
          p.year,
          [p.start_month, p.end_month].filter(Boolean).join(' ~ '),
          p.funding,
          p.status,
          n.name,
          n.status,
          n.due_date?.slice(0, 10),
          n.submit_date?.slice(0, 10),
          attachments.filter((a) => a.node_id === n.id).length,
        ])
      }
    }
    downloadCsv(`全部项目台账_${new Date().toISOString().slice(0, 10)}.csv`, [head, ...rows])
  }

  function exportFiles() {
    const head = ['模块', '项目', '节点', '文件名', '版本', '大小(字节)', '上传时间']
    const rows = attachments.map((a) => {
      const p = projects.find((x) => x.id === a.project_id)
      const n = nodes.find((x) => x.id === a.node_id)
      return [
        p ? getModule(p.module_key).name : '',
        p?.name || '',
        n?.name || '未分类',
        a.file_name,
        a.version,
        a.size,
        a.created_at,
      ]
    })
    downloadCsv(`附件清单_${new Date().toISOString().slice(0, 10)}.csv`, [head, ...rows])
  }

  return (
    <>
      <div className="card">
        <h3>数据概览</h3>
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>模块</th>
                <th className="num">项目数</th>
                <th className="num">节点数</th>
                <th className="num">材料数</th>
              </tr>
            </thead>
            <tbody>
              {stat.map((s) => (
                <tr key={s.m.key}>
                  <td>
                    {s.m.icon} {s.m.name}
                  </td>
                  <td className="num">{s.projects}</td>
                  <td className="num">{s.nodes}</td>
                  <td className="num">{s.files}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>导出</h3>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn" onClick={exportAll}>
            导出全部项目台账（按节点展开）
          </button>
          <button className="btn" onClick={exportFiles}>
            导出附件清单
          </button>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          导出为 CSV，带 UTF-8 BOM，WPS / Excel 打开中文不乱码。
        </p>
      </div>

      <div className="card">
        <h3>附件存储规范</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          每个文件按「模块 / 项目 / 节点 / 文件名_v序号.扩展名」自动归档，同名文件重复上传不会覆盖，而是生成新版本。
        </p>
        <div className="path-eg">
          三个100课程 / 新能源汽车底盘技术 / 中期检查 / 中期检查报告_v2.pdf
        </div>
      </div>

      <BackupPanel />

      <div className="card">
        <h3>关于</h3>
        <p className="muted" style={{ marginTop: 0, lineHeight: 1.9 }}>
          本平台数据保存在云端数据库，换电脑、换浏览器登录同一账号即可看到同一份数据。
          <br />
          附件保存在云端对象存储，数据库只记录路径与元信息。
          <br />
          数据按账号与角色隔离：填报人只能看到自己主持的课程，管理员与审核人可见全部。
        </p>
      </div>
    </>
  )
}
