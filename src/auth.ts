import { cloud } from './cloud'
import type { Member } from './types'

/** 手机号归一化：仅保留数字并取后 11 位 */
export function normPhone(s?: string | null): string {
  const d = String(s || '').replace(/\D/g, '')
  return d.length >= 11 ? d.slice(-11) : d
}

export interface PermResult {
  member: Member | null
  isAdmin: boolean
  canSubmit: boolean
  canReview: boolean
  allowed: boolean
  members: Member[]
}

/** 管理员/审核者才可拉取完整名单；普通填报者调用会返回空。 */
export async function fetchMembers(): Promise<Member[]> {
  const { data, error } = await cloud.database.from('members').select('*').order('id', { ascending: true })
  if (error) return []
  return (data || []) as Member[]
}

function sessionPhone(session: any): string {
  const u = session?.user || {}
  return (
    normPhone(u.phone) ||
    normPhone(u.phone_number) ||
    normPhone(u.name) ||
    normPhone(u.user_metadata?.phone) ||
    normPhone(u.user_metadata?.phone_number)
  )
}

/** 读取当前登录人自己的成员记录（服务端按 auth.uid() 匹配，不暴露他人数据） */
async function loadSelf(): Promise<Member | null> {
  try {
    const { data, error } = await cloud.database.rpc('my_member')
    if (error) return null
    const arr = (data || []) as Member[]
    return arr[0] || null
  } catch {
    return null
  }
}

/** 用手机号认领成员记录（服务端校验后绑定，前端不经手他人数据） */
async function claim(phone: string): Promise<Member | null> {
  if (normPhone(phone).length !== 11) return null
  try {
    const { data, error } = await cloud.database.rpc('claim_member', { p_phone: phone })
    if (error) return null
    const arr = (data || []) as Member[]
    return arr[0] || null
  } catch {
    return null
  }
}

/**
 * 加载当前登录人的人员档案与权限。
 * 全流程走服务端函数，前端不读取他人成员记录。
 */
export async function loadPerm(session: any): Promise<PermResult> {
  const phone = sessionPhone(session)

  let me = await loadSelf()

  // 已登记但尚未绑定账号：尝试用会话里的手机号自动绑定
  if (!me && phone.length === 11) {
    me = await claim(phone)
  }

  if (!me || !me.active) {
    return { member: null, isAdmin: false, canSubmit: false, canReview: false, allowed: false, members: [] }
  }

  const isAdmin = !!me.is_admin
  const canReview = !!me.can_review

  // 仅管理员/审核者需要完整名单用于展示
  const members = isAdmin || canReview ? await fetchMembers() : []

  return {
    member: me,
    isAdmin,
    canSubmit: !!me.can_submit || isAdmin,
    canReview: canReview || isAdmin,
    allowed: true,
    members,
  }
}

/** 手动认领：由服务端校验手机号归属，成功即绑定当前登录账号 */
export async function bindMember(
  phone: string,
  _uid: string,
  _members: Member[],
): Promise<{ ok: boolean; message: string }> {
  if (normPhone(phone).length !== 11) return { ok: false, message: '请输入 11 位手机号' }

  const got = await claim(phone)
  if (!got) {
    return { ok: false, message: '该手机号未登记、已停用，或已绑定其他登录账号，请联系管理员核实' }
  }
  return { ok: true, message: '绑定成功' }
}
