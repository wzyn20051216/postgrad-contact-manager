import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { errorHandler } from './middlewares/errorHandler.js'
import { registerRoutes } from './routes/index.js'

const clientDistPathCandidates = [
  resolve(process.cwd(), 'packages/client/dist'),
  resolve(process.cwd(), '../client/dist'),
]

const clientDistPath = clientDistPathCandidates.find((path) => existsSync(path))

/**
 * @description 解析逗号分隔的域名配置。
 * @param value 原始配置字符串
 * @returns 域名数组
 */
function parseOriginList(value: string | undefined): string[] {
  if (!value) {
    return []
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

/**
 * @description 根据环境变量构建允许的跨域来源列表。
 * @returns 允许跨域来源
 */
function buildAllowedOrigins(): string[] {
  const originsFromEnv = parseOriginList(process.env.CORS_ORIGIN)
  if (originsFromEnv.length > 0) {
    return originsFromEnv
  }

  const domain = process.env.DOMAIN?.trim()
  if (domain && domain !== 'localhost') {
    return [`https://${domain}`]
  }

  return ['http://localhost:5173']
}

/**
 * @description 解析 Express trust proxy 配置。
 * @returns 可用于 app.set('trust proxy', value) 的配置值
 */
function resolveTrustProxySetting(): boolean | number | string {
  const raw = process.env.TRUST_PROXY?.trim()
  if (!raw) {
    return process.env.NODE_ENV === 'production' ? 1 : false
  }

  const lowerRaw = raw.toLowerCase()
  if (lowerRaw === 'true') {
    return true
  }
  if (lowerRaw === 'false') {
    return false
  }
  if (/^\d+$/.test(raw)) {
    return Number(raw)
  }
  return raw
}

/** @description 创建并配置 Express 应用实例 */
export function createApp(): Express {
  const app = express()
  const allowedOrigins = buildAllowedOrigins()
  const trustProxy = resolveTrustProxySetting()

  /** @description 生产环境下信任反向代理，避免限流中间件误判来源 IP */
  app.set('trust proxy', trustProxy)

  /** @description 注册基础中间件 */
  app.use(helmet())
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true)
          return
        }

        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          callback(null, true)
          return
        }

        callback(null, false)
      },
      credentials: true,
    })
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))

  /** @description 注册 API 路由 */
  registerRoutes(app)

  /** @description 未匹配 API 路由统一返回 404 */
  app.use('/api', (_req, res) => {
    res.status(404).json({
      success: false,
      message: 'API route not found',
    })
  })

  /** @description 托管前端构建产物并支持 SPA 路由 */
  if (clientDistPath) {
    const clientIndexPath = resolve(clientDistPath, 'index.html')
    app.use(express.static(clientDistPath))
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next()
      }
      res.sendFile(clientIndexPath)
    })
  }

  /** @description 注册全局错误处理中间件 */
  app.use(errorHandler)

  return app
}
