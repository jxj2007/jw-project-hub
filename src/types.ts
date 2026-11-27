export type ModuleKey = 'three100' | 'workshop' | 'innovation' | 'other'

export interface Project {
  id: number
  owner_id?: string
  module_key: ModuleKey
  name: string
  code: string | null
  dept: string | null
  leader: string | null
  members: string | null
  phone: string | null
  category: string | null
  level: string | null
  year: number | null
  start_month: string | null
  end_month: string | null
  funding: number | null
  /** 关联的填报人（members.id），决定谁能在平台看到这门课 */
  contributor_id?: number | null
  /** 填报人的登录账号 ID，文件按此归属存放，便于课程负责人读取 */
  contributor_uid?: string | null
  stage: string | null
  status: string
  remark: string | null
  extra: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface ProjectNode {
  id: number
  project_id: number
  name: string
  sort_order: number
  status: string
  due_date: string | null
  submit_date: string | null
  review_date: string | null
  conclusion: string | null
  problems: string | null
  requirements: string | null
  score: number | null
  remark: string | null
  submitter_name?: string | null
  reviewer_name?: string | null
  review_comment?: string | null
}

export interface NodeRequest {
  id: number
  project_id: number
  node_id: number
  payload: {
    conclusion?: string | null
    submit_date?: string | null
    due_date?: string | null
    remark?: string | null
  }
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn'
  applicant_name: string | null
  apply_time: string
  reviewer_name: string | null
  review_time: string | null
  result: string | null
  problems: string | null
  requirements: string | null
}

export interface ProjectChange {
  id: number
  project_id: number
  title: string
  content: string | null
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn'
  applicant_name: string | null
  apply_time: string
  reviewer_name: string | null
  review_time: string | null
  result: string | null
  problems: string | null
  requirements: string | null
}

export interface DeletionBackup {
  id: number
  table_name: string
  record_id: string | null
  project_id: number | null
  payload: any
  operator: string | null
  status: string
  note: string | null
  created_at: string
}

export interface Member {
  id: number
  user_id: string | null
  name: string
  phone: string | null
  dept: string | null
  is_admin: boolean
  can_submit: boolean
  can_review: boolean
  active: boolean
  remark: string | null
  created_at: string
}

export interface Textbook {
  id: number
  project_id: number | null
  project_code: string | null
  name: string
  editor: string | null
  partner: string | null
  textbook_type: string | null
  publisher: string | null
  publish_date: string | null
  has_contract: boolean
  contract_name: string | null
  contract_path: string | null
  review_status: string
  submit_time: string | null
  submitter_name: string | null
  reviewer_name: string | null
  review_time: string | null
  review_comment: string | null
  remark: string | null
  created_at: string
  updated_at: string
}

export const TEXTBOOK_TYPES = ['数字教材', '纸质教材', '活页式教材', '口袋书', '其他']

export interface CaseItem {
  id: number
  project_id: number | null
  project_code: string | null
  title: string
  case_type: string | null
  background: string | null
  problem: string | null
  approach: string | null
  result: string | null
  remark: string | null
  created_at: string
  updated_at: string
}

export const CASE_TYPES = ['课程思政案例', '教学改革案例', '产教融合案例', '课堂教学案例', '其他']

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  pending: '待审核',
  approved: '已通过',
  rejected: '已退回',
}

/** 权限对象 */
export interface Perm {
  member: Member | null
  isAdmin: boolean
  canSubmit: boolean
  canReview: boolean
  allowed: boolean
  loading: boolean
  members?: Member[]
  reload: () => Promise<void>
}

export interface Attachment {
  id: number
  project_id: number
  node_id: number | null
  file_name: string
  display_name: string | null
  storage_path: string
  size: number | null
  mime: string | null
  version: number
  remark: string | null
  created_at: string
}

export interface DictOption {
  id: number
  kind: string
  module_key: string | null
  value: string
  sort_order: number
}

export interface ChangeLog {
  id: number
  project_id: number | null
  action: string
  detail: string | null
  created_at: string
}

export const NODE_STATUS = ['未开始', '进行中', '已提交', '已通过', '需整改'] as const
export const PROJECT_STATUS = ['未开始', '进行中', '已提交', '已通过', '需整改', '已结题'] as const
export const LEVELS = ['国家级', '省级', '市级', '校级', '院级']
