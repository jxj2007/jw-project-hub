import type { ModuleKey } from './types'

export type FieldType = 'text' | 'number' | 'select' | 'textarea'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  options?: string[]
  required?: boolean
  placeholder?: string
  width?: 'full' | 'half'
  /** 是否在列表页显示为一列 */
  showInList?: boolean
}

export interface ModuleDef {
  key: ModuleKey
  name: string
  short: string
  itemLabel: string
  icon: string
  nameLabel: string
  leaderLabel: string
  /** 模块专属字段，写入 projects.extra */
  fields: FieldDef[]
  /** 节点模板，建项目时自动生成 */
  nodeTemplates: string[]
}

/** 三个模块共用的公共字段（映射到 projects 主表列） */
export const COMMON_FIELDS: FieldDef[] = [
  { key: 'name', label: '名称', type: 'text', required: true, width: 'full' },
  { key: 'code', label: '编号', type: 'text' },
  { key: 'dept', label: '所属院部', type: 'text' },
  { key: 'leader', label: '负责人', type: 'text', required: true },
  { key: 'members', label: '团队成员', type: 'text' },
  { key: 'phone', label: '联系电话', type: 'text' },
  { key: 'category', label: '类别', type: 'select' },
  { key: 'level', label: '级别', type: 'select' },
  { key: 'year', label: '立项年度', type: 'number' },
  { key: 'start_month', label: '建设起始', type: 'text', placeholder: '如 2026-03' },
  { key: 'end_month', label: '建设截止', type: 'text', placeholder: '如 2028-12' },
  { key: 'funding', label: '经费（万元）', type: 'number' },
  { key: 'remark', label: '备注', type: 'textarea', width: 'full' },
]

export const DEPARTMENTS = [
  '医学院',
  '艺术与体育学院',
  '数智商贸学院',
  '信息工程学院',
  '智能制造学院',
  '华友新材料学院',
  '现代生活学院',
  '公共教育学院',
]

export const COURSE_NATURES = [
  '专业核心课',
  '专业拓展课',
  '专业基础课',
  '公共课',
  '通识课',
  '全校公选课',
]

export const MODULES: ModuleDef[] = [
  {
    key: 'three100',
    name: '三个100项目化课程建设',
    short: '三个100课程',
    itemLabel: '课程',
    icon: '📘',
    nameLabel: '课程名称',
    leaderLabel: '课程主持人',
    nodeTemplates: ['任务书签订', '中期检查', '结题验收'],
    fields: [
      { key: 'major', label: '适用专业名称', type: 'text', width: 'full' },
      { key: 'course_nature', label: '课程性质', type: 'select', options: COURSE_NATURES, showInList: true },
      { key: 'title', label: '职称', type: 'text' },
      {
        key: 'textbook_digital',
        label: '是否数字化教材',
        type: 'select',
        options: ['是', '否', '建设中'],
        showInList: true,
      },
      {
        key: 'textbook_published',
        label: '是否出版',
        type: 'select',
        options: ['是', '否', '出版中'],
        showInList: true,
      },
      { key: 'textbook_name', label: '教材名称', type: 'text', width: 'full' },
      { key: 'batch', label: '建设批次', type: 'select', options: ['2025人工智能改造', '2026首批', '2027', '2028', '2029'] },
      { key: 'pay1', label: '第一期拨付(万元)', type: 'number' },
      { key: 'pay2', label: '第二期拨付(万元)', type: 'number' },
    ],
  },
  {
    key: 'workshop',
    name: '百课工坊',
    short: '百课工坊',
    itemLabel: '期',
    icon: '🎤',
    nameLabel: '期次',
    leaderLabel: '主办学院',
    nodeTemplates: ['活动筹备', '活动实施', '总结归档'],
    fields: [
      { key: 'month', label: '举办月份', type: 'text', placeholder: '如 2026-12', showInList: true },
      { key: 'topic', label: '活动主题', type: 'text', width: 'full' },
      { key: 'speaker', label: '主讲人', type: 'text' },
      { key: 'venue', label: '活动地点', type: 'text' },
      { key: 'attendees', label: '参加人数', type: 'number' },
      {
        key: 'format',
        label: '举办形式',
        type: 'select',
        options: ['线下', '线上', '线上线下结合'],
        showInList: true,
      },
    ],
  },
  {
    key: 'innovation',
    name: '教学创新建设管理',
    short: '教学创新建设',
    itemLabel: '项目',
    icon: '💡',
    nameLabel: '项目名称',
    leaderLabel: '负责人',
    nodeTemplates: ['申报立项', '中期检查', '结题验收'],
    fields: [
      {
        key: 'inn_type',
        label: '创新项目类型',
        type: 'select',
        options: ['教学创新团队', '课堂教学创新项目', '教改项目', '教学能力竞赛', '教学成果培育'],
      },
      { key: 'partner', label: '合作单位', type: 'text' },
      { key: 'team_size', label: '团队人数', type: 'number' },
    ],
  },
  {
    key: 'other',
    name: '其他项目建设',
    short: '其他项目',
    itemLabel: '项目',
    icon: '🗂',
    nameLabel: '项目名称',
    leaderLabel: '负责人',
    nodeTemplates: ['申报立项', '中期检查', '结题验收'],
    fields: [
      { key: 'source', label: '项目来源单位', type: 'text' },
      { key: 'other_type', label: '项目类型', type: 'text' },
      { key: 'contract_no', label: '合同/批文号', type: 'text' },
    ],
  },
]

export function getModule(key: string): ModuleDef {
  return MODULES.find((m) => m.key === key) || MODULES[0]
}

/** 附件目录规范：模块 / 项目 / 节点 / 文件 */
export function safeSegment(raw: string): string {
  const s = (raw || '未命名')
    .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  return s || '未命名'
}

export function fmtMoney(n: number | null | undefined) {
  if (n === null || n === undefined || (n as any) === '') return '—'
  return `${Number(n)} 万`
}

export function fmtDate(s?: string | null) {
  if (!s) return '—'
  return String(s).slice(0, 10)
}
