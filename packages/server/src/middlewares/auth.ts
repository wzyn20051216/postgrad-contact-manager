import { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/database.js'
import { verifyToken } from '../utils/token.js'
import { error as errorResponse } from '../utils/response.js'

/** JWT 认证中间件 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  const [scheme, token] = authHeader?.split(' ') ?? []

  if (scheme !== 'Bearer' || !token) {
    return errorResponse(res, '未提供认证令牌', 401)
  }

  try {
    const decoded = verifyToken(token)
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        tokenVersion: true,
      },
    })

    if (!currentUser || currentUser.tokenVersion !== decoded.tokenVersion) {
      return errorResponse(res, '登录状态已失效，请重新登录', 401)
    }

    req.user = {
      id: currentUser.id,
      email: currentUser.email,
      tokenVersion: currentUser.tokenVersion,
    }
    next()
  } catch {
    return errorResponse(res, '认证令牌无效或已过期', 401)
  }
}
