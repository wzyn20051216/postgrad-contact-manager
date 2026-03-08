import dotenv from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envPathCandidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(process.cwd(), 'packages/server/.env'),
]

const envPath = envPathCandidates.find((path) => existsSync(path))

if (envPath) {
  dotenv.config({ path: envPath })
}

const jwtSecret = process.env.JWT_SECRET?.trim()

if (!jwtSecret) {
  console.error('JWT_SECRET is required and cannot be empty.')
  process.exit(1)
}

/**
 * @description 解析整型环境变量并限制范围。
 * @param rawValue 原始字符串
 * @param fallback 默认值
 * @param min 最小值
 * @param max 最大值
 * @returns 解析后的值
 */
function parseIntInRange(rawValue: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(rawValue || '', 10)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  if (parsed < min) {
    return min
  }
  if (parsed > max) {
    return max
  }
  return parsed
}

/**
 * @description 解析布尔环境变量。
 * @param rawValue 原始字符串
 * @param fallback 默认值
 * @returns 布尔值
 */
function parseBoolean(rawValue: string | undefined, fallback: boolean): boolean {
  if (!rawValue) {
    return fallback
  }

  const normalizedValue = rawValue.trim().toLowerCase()
  if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
    return true
  }
  if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
    return false
  }

  return fallback
}

/**
 * @description 解析逗号分隔字符串
 * @param rawValue 原始配置值
 * @returns 去重且归一化后的字符串列表
 */
function parseStringList(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return []
  }

  const normalizedSet = new Set(
    rawValue
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0)
  )
  return Array.from(normalizedSet)
}

const port = parseIntInRange(process.env.PORT, 3000, 1, 65535)
const domain = process.env.DOMAIN?.trim()
const appBaseUrl = process.env.APP_BASE_URL?.trim()
  || (domain && domain !== 'localhost' ? `https://${domain}` : 'http://localhost:5173')
const serverPublicUrl = process.env.SERVER_PUBLIC_URL?.trim()
  || (domain && domain !== 'localhost' ? `https://${domain}` : `http://localhost:${port}`)
const smtpHost = process.env.SMTP_HOST?.trim() || ''
const smtpPort = parseIntInRange(process.env.SMTP_PORT, 465, 1, 65535)
const smtpUser = process.env.SMTP_USER?.trim() || ''
const smtpPass = process.env.SMTP_PASS?.trim() || ''
const smtpFrom = process.env.SMTP_FROM?.trim() || ''
const smtpFromName = process.env.SMTP_FROM_NAME?.trim() || '套磁管理系统'
const smtpSecure = parseBoolean(process.env.SMTP_SECURE, true)
const githubClientId = process.env.GITHUB_CLIENT_ID?.trim() || ''
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() || ''
const githubRedirectUri = process.env.GITHUB_REDIRECT_URI?.trim()
  || `${serverPublicUrl}/api/auth/github/callback`
const forumAdminEmails = parseStringList(process.env.FORUM_ADMIN_EMAILS)

export const config = {
  /** 服务端口 */
  port,

  /** 数据库连接地址 */
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',

  /** JWT 密钥 */
  jwtSecret,

  /** JWT 过期时间 */
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  /** 前端应用访问地址 */
  appBaseUrl,

  /** 服务端对外访问地址 */
  serverPublicUrl,

  /** 注册验证码有效期（分钟） */
  registerCodeExpiresMinutes: parseIntInRange(process.env.REGISTER_CODE_EXPIRES_MINUTES, 10, 1, 60),

  /** 注册验证码重发冷却时间（秒） */
  registerCodeResendCooldownSeconds: parseIntInRange(
    process.env.REGISTER_CODE_RESEND_COOLDOWN_SECONDS,
    60,
    10,
    600
  ),

  /** 重置密码验证码有效期（分钟） */
  resetPasswordCodeExpiresMinutes: parseIntInRange(
    process.env.RESET_PASSWORD_CODE_EXPIRES_MINUTES,
    parseIntInRange(process.env.REGISTER_CODE_EXPIRES_MINUTES, 10, 1, 60),
    1,
    60
  ),

  /** 重置密码验证码重发冷却时间（秒） */
  resetPasswordCodeResendCooldownSeconds: parseIntInRange(
    process.env.RESET_PASSWORD_CODE_RESEND_COOLDOWN_SECONDS,
    parseIntInRange(process.env.REGISTER_CODE_RESEND_COOLDOWN_SECONDS, 60, 10, 600),
    10,
    600
  ),

  /** GitHub OAuth 授权状态有效期 */
  oauthStateExpiresIn: process.env.OAUTH_STATE_EXPIRES_IN || '10m',

  /** SMTP 是否已完整配置 */
  smtpEnabled: Boolean(smtpHost && smtpFrom),

  /** SMTP 主机 */
  smtpHost,

  /** SMTP 端口 */
  smtpPort,

  /** SMTP 用户名 */
  smtpUser,

  /** SMTP 密码 */
  smtpPass,

  /** SMTP 发件人邮箱 */
  smtpFrom,

  /** SMTP 发件人名称 */
  smtpFromName,

  /** SMTP 是否启用 SSL */
  smtpSecure,

  /** GitHub Client ID */
  githubClientId,

  /** GitHub Client Secret */
  githubClientSecret,

  /** GitHub Callback 地址 */
  githubRedirectUri,

  /** GitHub 登录是否启用 */
  githubEnabled: Boolean(githubClientId && githubClientSecret),

  /** 论坛管理员邮箱白名单 */
  forumAdminEmails,

  /** 资源巡检任务开关 */
  resourceHealthSchedulerEnabled: process.env.RESOURCE_HEALTH_SCHEDULER_ENABLED !== 'false',

  /** 每日巡检小时（本地时区） */
  resourceHealthScheduleHour: parseIntInRange(process.env.RESOURCE_HEALTH_SCHEDULE_HOUR, 3, 0, 23),

  /** 每日巡检分钟（本地时区） */
  resourceHealthScheduleMinute: parseIntInRange(process.env.RESOURCE_HEALTH_SCHEDULE_MINUTE, 0, 0, 59),

  /** 单次巡检每个用户最大检测数量 */
  resourceHealthMaxCheckPerUser: parseIntInRange(process.env.RESOURCE_HEALTH_MAX_CHECK_PER_USER, 200, 1, 1000),

  /** 链接检测超时时间（毫秒） */
  resourceHealthTimeoutMs: parseIntInRange(process.env.RESOURCE_HEALTH_TIMEOUT_MS, 8000, 1000, 30000),
}
