import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk'

// Values come from the cloud-service activation (publicConfig).
// endpoint / publishableKey are public by design; the server enforces exact-Origin matching.
export const publicConfig = {
  endpoint: 'https://jw-project-hub.app.workbuddy.host',
  oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
  publishableKey: 'wbpk_mEavbs2nu32sdoKMbXbSSD_gyXZdLnFMYgaAtmg33gCaVBKz2RTtILg',
}

export const cloud = createWorkBuddyCloud<any>({
  endpoint: publicConfig.endpoint,
  oauthRelayBaseUrl: publicConfig.oauthRelayBaseUrl,
  publishableKey: publicConfig.publishableKey,
})

export function unwrap<T>(res: { data: T; error: any }): T {
  if (res.error) throw res.error
  return res.data
}

export function errText(e: any): string {
  if (!e) return '未知错误'
  return e.message || e.error_description || String(e)
}
