import { Request, Response, NextFunction } from 'express'

/**
 * @description 业务错误类型，携带 HTTP 状态码。
 */
export class AppError extends Error {
  statusCode: number

  /**
   * @param message 错误消息
   * @param statusCode HTTP 状态码
   */
  constructor(message: string, statusCode: number = 400) {
    super(message)
    this.statusCode = statusCode
    this.name = 'AppError'
  }
}

/**
 * @description 全局错误处理中间件。
 * @param err 错误对象
 * @param _req 请求对象（未使用）
 * @param res 响应对象
 * @param _next 下一中间件（未使用）
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('[错误]', err.message)

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    })
  }

  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      message: '参数校验失败',
      errors: (err as any).errors,
    })
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    return res.status(400).json({
      success: false,
      message: '数据库操作失败',
    })
  }

  if (err.name === 'PrismaClientInitializationError') {
    return res.status(500).json({
      success: false,
      message: '数据库连接初始化失败，请检查 DATABASE_URL 配置',
    })
  }

  return res.status(500).json({
    success: false,
    message: '服务器内部错误',
  })
}
