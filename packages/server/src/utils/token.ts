import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'

export interface TokenPayload {
  id: string
  email: string
  tokenVersion: number
}

interface GithubStatePayload {
  type: 'github_oauth_state'
  redirectTo: string
  entry: 'login' | 'register'
}

/** 生成 JWT */
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions)
}

/** 验证 JWT */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as TokenPayload
}

/**
 * @description 生成 GitHub OAuth 状态令牌。
 * @param redirectTo 登录成功后的前端跳转路径
 * @param entry 发起授权的页面
 * @returns 状态令牌
 */
export function generateGithubStateToken(redirectTo: string, entry: 'login' | 'register'): string {
  return jwt.sign(
    {
      type: 'github_oauth_state',
      redirectTo,
      entry,
    } satisfies GithubStatePayload,
    config.jwtSecret,
    {
      expiresIn: config.oauthStateExpiresIn,
    } as jwt.SignOptions
  )
}

/**
 * @description 验证 GitHub OAuth 状态令牌。
 * @param token 状态令牌
 * @returns 状态载荷
 */
export function verifyGithubStateToken(token: string): GithubStatePayload {
  const decoded = jwt.verify(token, config.jwtSecret) as GithubStatePayload

  if (decoded.type !== 'github_oauth_state') {
    throw new Error('Invalid GitHub OAuth state token')
  }

  return decoded
}
