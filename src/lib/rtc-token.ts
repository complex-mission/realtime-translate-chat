// @ts-ignore - type definition is wrong, actual function takes 4 args
import { produce } from '@dingrtc/token-generator'

export function generateRtcToken(
  channelId: string,
  userId: string,
  _privilegeExpireTime: number = 86400
): { token: string; appId: string } {
  const appId = process.env.RTC_APP_ID
  const appKey = process.env.RTC_APP_KEY

  if (!appId || !appKey) {
    throw new Error(`Missing RTC config: appId=${appId}, appKey=${appKey ? '***' : 'undefined'}`)
  }

  // @ts-ignore - produce actually takes 4 args: (appId, appKey, channelId, userId)
  const token: string = produce(appId, appKey, channelId, userId)

  return {
    token,
    appId,
  }
}
