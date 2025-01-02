import { Context, Schema } from 'koishi'
import https from 'https'
export const name = 'weibo-monitor'

export interface Config {
  account: string,
  plantform: string,
  waitMinutes: number,
  sendINFO: any,
}

export const Config: Schema<Config> = Schema.object({
  account: Schema.string().description("账号(qq号)"),
  plantform: Schema.string().default("onebot").description("账号平台"),
  waitMinutes: Schema.number().default(3).min(1).description("检查间隔分钟"),
  sendINFO: Schema.array(Schema.object({
    sendAll: Schema.boolean().default(false).description("@全体"),
    weiboUID: Schema.string().description("微博UID"),
    groupID: Schema.string().description("需要发送的群组"),
  })).description("监听&发送配置"),
})

export function to<T, U = Error>(
  promise: Promise<T>,
  errorExt?: object
): Promise<[U, undefined] | [null, T]> {
  return promise
    .then<[null, T]>((data: T) => [null, data])
    .catch<[U, undefined]>((err: U) => {
      if (errorExt) {
        const parsedError = Object.assign({}, err, errorExt);
        return [parsedError, undefined];
      }
      return [err, undefined];
    });
}
export function apply(ctx: Context, config: Config) {
  const commonConfig = {
    account: config.account,
    plantform: config.plantform,
    waitMinutes: config.waitMinutes,
  }
  ctx.setInterval(async () => {
    for (const singleConfig of config.sendINFO) {
      const params = { ...commonConfig, ...singleConfig }
      const [err, res] = await to(getWeibo(params))
      if (err) { console.error(err); return }
      const data = res.data || {}
      const weiboList = data.list || []
      const latestWeibo = weiboList[0] || {}
      let message = getMessage(params, latestWeibo)
      if (!message) { continue }
      if (params.sendAll) {
        message = '<at id="all"/> ' + message
      }
      ctx.bots[`${config.plantform}:${config.account}`].sendMessage(params.groupID, message)
    }
  }, config.waitMinutes > 0 ? config.waitMinutes * 60 * 1000 : 60000)
}

const getMessage = (params: any, latestWeibo: any): string => {
  if (!latestWeibo) { return '' }
  const { created_at, user } = latestWeibo
  const time = parseDateString(created_at)
  const lastCheckTime = Date.now() - (params.waitMinutes > 0 ? params.waitMinutes * 60 * 1000 : 60000)
  if (time.getTime() < lastCheckTime) {
    return ''
  }
  const screenName = user?.screen_name || ''
  let weiboType = -1
  //获取微博类型0-视频，2-图文,1-转发微博
  if ('page_info' in latestWeibo) { weiboType = 0 }
  if ('pic_infos' in latestWeibo) { weiboType = 2 }
  if ('topic_struct' in latestWeibo || 'retweeted_status' in latestWeibo) { weiboType = 1 }
  let message = ''
  if (weiboType == 0) {
    const pageInfo = latestWeibo?.page_info
    if (!pageInfo) { return message }
    const objType = pageInfo?.object_type || ''
    if (objType == 'video') {
      const text = latestWeibo?.text_raw || ''
      const video = pageInfo?.media_info?.h5_url || ''
      message += (screenName + " 发布了微博:\n" + text + "\n" + video) || ''
    }
  }
  if (weiboType == 1) {
    message += (screenName + " 转发了微博:\n" + latestWeibo?.text_raw || '')
  }
  if (weiboType == 2) {
    const text = latestWeibo?.text_raw || ''
    const picIds = latestWeibo?.pic_ids || []
    const picInfos = latestWeibo?.pic_infos || {}
    const firstPicUrl = picInfos?.[picIds[0]]?.large?.url || ''
    const picture = `<img src="${firstPicUrl}"/>`
    message += (screenName + " 发布了微博:\n" + text + "\n" + picture) || ''
  }
  const mid = latestWeibo?.mid || ''
  const url = `\n链接：https://m.weibo.cn/status/${mid}`
  return message ? message + url : (screenName + " 发布了微博:\n" + latestWeibo?.text_raw + url) || ''
}
const getWeibo = async (config: any, callback?: any): Promise<any> => {
  const { weiboUID } = config
  if (!weiboUID) { return }
  const headers = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
    "cache-control": "no-cache",
    "cookie": "XSRF-TOKEN=mgVY3WMp8U-T6Wbu24ifdazm; SUBP=0033WrSXqPxfM72-Ws9jqgMF55529P9D9WhizH8r9Hyn870HzJo4TQoB; SUB=_2AkMSf_1df8NxqwJRmfATxWrlaIV_ywjEieKkIwyGJRMxHRl-yj8XqksbtRB6Of_Tsj1wFglssEkNvyqikP19B0UlIrd8; WBPSESS=NcA3pTjBP9SOtpsXaAXWlx_1aL3IfVadLkk5h-hKiZrhJi_NyNc2r5RbB0ZE0gYuG6ZSJmF8k26JJ46ltyme0fAcMSF9VPonnDU1TPvBjVADJPPa99vi0TVPQDCUKIMU",
    "referer": "https://passport.weibo.com/",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
  }
  const options = {
    hostname: "weibo.com",
    path: "/ajax/statuses/mymblog?uid=" + weiboUID,
    method: "GET",
    headers: headers
  }
  return new Promise((resolve) => {
    https.get(options, (res) => {
      let body = ""
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        const returnData = JSON.parse(body);
        callback?.(returnData)
        resolve(returnData)
      })
    })
  })

}

const parseDateString = (dateString) => {
  // 定义正则表达式解析自定义时间格式
  // 正则表达式解析时间字符串
  const regex = /(\w+) (\w+) (\d+) (\d+):(\d+):(\d+) ([+-]\d{4}) (\d{4})/;
  const match = dateString.match(regex);

  if (!match) {
    throw new Error("Invalid date format");
  }

  const [, , month, day, hour, minute, second, timezone, year] = match;

  // 月份映射
  const monthMap = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };

  // 创建UTC时间
  let date = new Date(Date.UTC(year, monthMap[month], day, hour, minute, second));

  // 处理时区偏移（例如 +0800）
  const timezoneOffsetHours = parseInt(timezone.slice(0, 3), 10);
  const timezoneOffsetMinutes = parseInt(timezone.slice(0, 1) + timezone.slice(3), 10);
  const timezoneOffset = timezoneOffsetHours * 60 + timezoneOffsetMinutes;

  // 调整时间为本地时区
  date.setUTCMinutes(date.getUTCMinutes() - timezoneOffset);

  return date;
}
