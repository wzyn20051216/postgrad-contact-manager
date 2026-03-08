import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '../config/database.js'
import { config } from '../config/index.js'
import { AppError } from '../middlewares/errorHandler.js'
import { comparePassword, hashPassword } from '../utils/password.js'
import {
  generateGithubStateToken,
  generateToken,
  verifyGithubStateToken,
} from '../utils/token.js'
import { mailService, type MailSendResult } from './mail.service.js'

interface GithubAccessTokenResponse {
  access_token?: string
  error?: string
  error_description?: string
}

interface GithubProfileResponse {
  id: number
  login: string
  name: string | null
  avatar_url: string | null
  email: string | null
}

interface GithubEmailResponseItem {
  email: string
  primary: boolean
  verified: boolean
}

interface PublicUserProfile {
  id: string
  email: string
  nickname: string | null
  avatar: string | null
  emailVerified: boolean
  githubUsername: string | null
  createdAt: Date
}

interface AuthenticatedUserProfile extends PublicUserProfile {
  tokenVersion: number
}

interface GithubAuthResult {
  entry: 'login' | 'register'
  redirectTo: string
  token: string
  user: PublicUserProfile
}

interface VerificationCodeDispatchOptions {
  email: string
  purpose: string
  expiresMinutes: number
  cooldownSeconds: number
  sendMail: (verificationCode: string) => Promise<MailSendResult>
}

const REGISTER_CODE_PURPOSE = 'REGISTER'
const RESET_PASSWORD_CODE_PURPOSE = 'RESET_PASSWORD'
const GITHUB_OAUTH_SCOPE = 'read:user user:email'
const GITHUB_API_HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'postgrad-contact-manager',
  'X-GitHub-Api-Version': '2022-11-28',
}

const publicUserSelect = {
  id: true,
  email: true,
  nickname: true,
  avatar: true,
  emailVerified: true,
  githubUsername: true,
  createdAt: true,
} as const

const authUserSelect = {
  ...publicUserSelect,
  tokenVersion: true,
} as const

/**
 * @description 统一标准化邮箱。
 * @param email 原始邮箱
 * @returns 规范化邮箱
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * @description 生成固定长度数字验证码。
 * @returns 六位数字验证码
 */
function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/**
 * @description 对验证码进行不可逆摘要。
 * @param verificationCode 原始验证码
 * @returns 摘要值
 */
function hashVerificationCode(verificationCode: string): string {
  return createHash('sha256').update(verificationCode).digest('hex')
}

export class AuthService {
  /**
   * @description 发送注册验证码。
   * @param email 邮箱
   * @returns 发送结果
   */
  async sendRegisterCode(email: string) {
    const normalizedEmail = normalizeEmail(email)
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (existingUser) {
      throw new AppError('该邮箱已被注册', 409)
    }

    return this.dispatchVerificationCode({
      email: normalizedEmail,
      purpose: REGISTER_CODE_PURPOSE,
      expiresMinutes: config.registerCodeExpiresMinutes,
      cooldownSeconds: config.registerCodeResendCooldownSeconds,
      sendMail: (verificationCode) =>
        mailService.sendRegisterVerificationCode(
          normalizedEmail,
          verificationCode,
          config.registerCodeExpiresMinutes
        ),
    })
  }

  /**
   * @description 发送重置密码验证码。
   * @param email 邮箱
   * @returns 发送结果
   */
  async sendResetPasswordCode(email: string) {
    const normalizedEmail = normalizeEmail(email)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (!user) {
      return {
        expiresInSeconds: config.resetPasswordCodeExpiresMinutes * 60,
        cooldownSeconds: config.resetPasswordCodeResendCooldownSeconds,
        deliveryMode: config.smtpEnabled ? 'smtp' : 'debug',
        debugCode: null,
      }
    }

    return this.dispatchVerificationCode({
      email: normalizedEmail,
      purpose: RESET_PASSWORD_CODE_PURPOSE,
      expiresMinutes: config.resetPasswordCodeExpiresMinutes,
      cooldownSeconds: config.resetPasswordCodeResendCooldownSeconds,
      sendMail: (verificationCode) =>
        mailService.sendPasswordResetVerificationCode(
          normalizedEmail,
          verificationCode,
          config.resetPasswordCodeExpiresMinutes
        ),
    })
  }

  /**
   * @description 用户注册。
   * @param email 邮箱
   * @param password 密码
   * @param verificationCode 邮箱验证码
   * @param nickname 昵称
   * @returns 登录凭据
   */
  async register(email: string, password: string, verificationCode: string, nickname?: string) {
    const normalizedEmail = normalizeEmail(email)

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (existingUser) {
      throw new AppError('该邮箱已被注册', 409)
    }

    const verificationRecord = await this.validateVerificationCode(
      normalizedEmail,
      REGISTER_CODE_PURPOSE,
      verificationCode,
      {
        emptyMessage: '请先获取邮箱验证码',
        expiredMessage: '验证码已过期，请重新获取',
        invalidMessage: '验证码错误，请重新输入',
      }
    )
    const hashedPassword = await hashPassword(password)

    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          nickname: nickname?.trim() || null,
          emailVerified: true,
        },
        select: authUserSelect,
      })

      await tx.emailVerificationCode.update({
        where: { id: verificationRecord.id },
        data: {
          consumedAt: new Date(),
        },
      })

      return user
    })

    return this.createAuthResult(createdUser)
  }

  /**
   * @description 重置密码。
   * @param email 邮箱
   * @param verificationCode 验证码
   * @param newPassword 新密码
   */
  async resetPassword(email: string, verificationCode: string, newPassword: string) {
    const normalizedEmail = normalizeEmail(email)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (!user) {
      throw new AppError('账号不存在或验证码无效', 400)
    }

    const verificationRecord = await this.validateVerificationCode(
      normalizedEmail,
      RESET_PASSWORD_CODE_PURPOSE,
      verificationCode,
      {
        emptyMessage: '请先获取重置密码验证码',
        expiredMessage: '验证码已过期，请重新获取',
        invalidMessage: '验证码错误，请重新输入',
      }
    )

    const hashedPassword = await hashPassword(newPassword)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          emailVerified: true,
          tokenVersion: {
            increment: 1,
          },
        },
      }),
      prisma.emailVerificationCode.update({
        where: { id: verificationRecord.id },
        data: {
          consumedAt: new Date(),
        },
      }),
    ])
  }

  /**
   * @description 用户登录。
   * @param email 邮箱
   * @param password 密码
   * @returns 登录凭据
   */
  async login(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        ...authUserSelect,
        password: true,
      },
    })

    if (!user) {
      throw new AppError('邮箱或密码错误', 401)
    }

    const isPasswordValid = await comparePassword(password, user.password)
    if (!isPasswordValid) {
      throw new AppError('邮箱或密码错误', 401)
    }

    return this.createAuthResult(user)
  }

  /**
   * @description 获取 GitHub 授权地址。
   * @param redirectTo 登录成功后的前端路径
   * @param entry 发起授权的页面
   * @returns 授权地址
   */
  getGithubAuthorizeUrl(redirectTo?: string, entry?: string): string {
    if (!config.githubEnabled) {
      throw new AppError('GitHub 登录尚未配置，请先补充相关环境变量', 503)
    }

    const safeRedirectTo = this.sanitizeRedirectPath(redirectTo)
    const safeEntry = this.sanitizeEntry(entry)
    const state = generateGithubStateToken(safeRedirectTo, safeEntry)
    const searchParams = new URLSearchParams({
      client_id: config.githubClientId,
      redirect_uri: config.githubRedirectUri,
      scope: GITHUB_OAUTH_SCOPE,
      state,
      allow_signup: 'true',
    })

    return `https://github.com/login/oauth/authorize?${searchParams.toString()}`
  }

  /**
   * @description 处理 GitHub OAuth 回调。
   * @param code GitHub 返回的授权码
   * @param state GitHub 返回的状态令牌
   * @returns 登录结果与跳转信息
   */
  async handleGithubCallback(code: string, state: string): Promise<GithubAuthResult> {
    if (!config.githubEnabled) {
      throw new AppError('GitHub 登录尚未配置，请先补充相关环境变量', 503)
    }

    let oauthState: ReturnType<typeof verifyGithubStateToken>
    try {
      oauthState = verifyGithubStateToken(state)
    } catch {
      throw new AppError('GitHub 登录状态已失效，请重新发起登录', 400)
    }

    const accessToken = await this.exchangeGithubCodeForToken(code)
    const githubProfile = await this.fetchGithubProfile(accessToken)
    const githubEmail = await this.resolveGithubEmail(accessToken, githubProfile)
    const publicUser = await this.upsertGithubUser(githubProfile, githubEmail)
    const authResult = this.createAuthResult(publicUser)

    return {
      entry: oauthState.entry,
      redirectTo: oauthState.redirectTo,
      ...authResult,
    }
  }

  /** 根据 ID 获取用户信息 */
  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    })

    if (!user) {
      throw new AppError('用户不存在', 404)
    }

    return user
  }

  /**
   * @description 创建并发送验证码。
   * @param options 发送配置
   * @returns 发送结果
   */
  private async dispatchVerificationCode(options: VerificationCodeDispatchOptions) {
    const { email, purpose, expiresMinutes, cooldownSeconds, sendMail } = options
    const latestCodeRecord = await prisma.emailVerificationCode.findFirst({
      where: {
        email,
        purpose,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (latestCodeRecord && !latestCodeRecord.consumedAt) {
      const elapsedSeconds = Math.floor((Date.now() - latestCodeRecord.createdAt.getTime()) / 1000)
      const remainingSeconds = cooldownSeconds - elapsedSeconds
      if (remainingSeconds > 0) {
        throw new AppError(`发送过于频繁，请在 ${remainingSeconds} 秒后重试`, 429)
      }
    }

    const verificationCode = generateVerificationCode()
    const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000)
    const now = new Date()

    await prisma.$transaction([
      prisma.emailVerificationCode.updateMany({
        where: {
          email,
          purpose,
          consumedAt: null,
        },
        data: {
          consumedAt: now,
        },
      }),
      prisma.emailVerificationCode.create({
        data: {
          email,
          purpose,
          codeHash: hashVerificationCode(verificationCode),
          expiresAt,
        },
      }),
    ])

    const mailResult = await sendMail(verificationCode)

    return {
      expiresInSeconds: expiresMinutes * 60,
      cooldownSeconds,
      deliveryMode: mailResult.deliveryMode,
      debugCode: mailResult.previewCode ?? null,
    }
  }

  /**
   * @description 校验验证码。
   * @param email 邮箱
   * @param purpose 用途
   * @param verificationCode 验证码
   * @param messages 自定义提示
   * @returns 验证码记录
   */
  private async validateVerificationCode(
    email: string,
    purpose: string,
    verificationCode: string,
    messages: {
      emptyMessage: string
      expiredMessage: string
      invalidMessage: string
    }
  ) {
    const verificationRecord = await prisma.emailVerificationCode.findFirst({
      where: {
        email,
        purpose,
        consumedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!verificationRecord) {
      throw new AppError(messages.emptyMessage, 400)
    }

    if (verificationRecord.expiresAt.getTime() < Date.now()) {
      throw new AppError(messages.expiredMessage, 400)
    }

    if (verificationRecord.codeHash !== hashVerificationCode(verificationCode)) {
      throw new AppError(messages.invalidMessage, 400)
    }

    return verificationRecord
  }

  /**
   * @description 创建统一认证结果。
   * @param user 用户信息
   * @returns 认证结果
   */
  private createAuthResult(user: AuthenticatedUserProfile) {
    const { tokenVersion, ...publicUser } = user
    const token = generateToken({
      id: publicUser.id,
      email: publicUser.email,
      tokenVersion,
    })

    return {
      user: publicUser,
      token,
    }
  }

  /**
   * @description 规范化前端跳转路径，防止开放跳转。
   * @param redirectTo 原始跳转路径
   * @returns 安全路径
   */
  private sanitizeRedirectPath(redirectTo?: string): string {
    if (!redirectTo || !redirectTo.startsWith('/')) {
      return '/dashboard'
    }

    if (redirectTo.startsWith('//')) {
      return '/dashboard'
    }

    return redirectTo
  }

  /**
   * @description 校验授权入口页面。
   * @param entry 原始入口
   * @returns 入口标识
   */
  private sanitizeEntry(entry?: string): 'login' | 'register' {
    return entry === 'register' ? 'register' : 'login'
  }

  /**
   * @description 用授权码换取 GitHub Access Token。
   * @param code 授权码
   * @returns Access Token
   */
  private async exchangeGithubCodeForToken(code: string): Promise<string> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'postgrad-contact-manager',
      },
      body: JSON.stringify({
        client_id: config.githubClientId,
        client_secret: config.githubClientSecret,
        code,
        redirect_uri: config.githubRedirectUri,
      }),
    })

    if (!response.ok) {
      throw new AppError('GitHub 授权失败，请稍后重试', 502)
    }

    const payload = (await response.json()) as GithubAccessTokenResponse
    if (!payload.access_token) {
      throw new AppError(payload.error_description || 'GitHub 未返回访问令牌', 502)
    }

    return payload.access_token
  }

  /**
   * @description 获取 GitHub 用户基础信息。
   * @param accessToken Access Token
   * @returns 用户资料
   */
  private async fetchGithubProfile(accessToken: string): Promise<GithubProfileResponse> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        ...GITHUB_API_HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new AppError('获取 GitHub 用户信息失败', 502)
    }

    return (await response.json()) as GithubProfileResponse
  }

  /**
   * @description 解析 GitHub 可用邮箱。
   * @param accessToken Access Token
   * @param githubProfile GitHub 用户资料
   * @returns 邮箱
   */
  private async resolveGithubEmail(
    accessToken: string,
    githubProfile: GithubProfileResponse
  ): Promise<string> {
    if (githubProfile.email) {
      return normalizeEmail(githubProfile.email)
    }

    const response = await fetch('https://api.github.com/user/emails', {
      headers: {
        ...GITHUB_API_HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new AppError('获取 GitHub 邮箱信息失败', 502)
    }

    const emailList = (await response.json()) as GithubEmailResponseItem[]
    const targetEmail = emailList.find((item) => item.primary && item.verified)
      || emailList.find((item) => item.verified)

    if (!targetEmail) {
      throw new AppError('当前 GitHub 账号没有已验证邮箱，暂时无法完成登录', 400)
    }

    return normalizeEmail(targetEmail.email)
  }

  /**
   * @description 创建或绑定 GitHub 用户。
   * @param githubProfile GitHub 用户资料
   * @param email 已验证邮箱
   * @returns 对外用户信息
   */
  private async upsertGithubUser(
    githubProfile: GithubProfileResponse,
    email: string
  ): Promise<AuthenticatedUserProfile> {
    const githubId = String(githubProfile.id)
    const existingByGithubId = await prisma.user.findUnique({
      where: { githubId },
      select: {
        ...authUserSelect,
        password: true,
      },
    })
    const existingByEmail = await prisma.user.findUnique({
      where: { email },
      select: {
        ...authUserSelect,
        password: true,
      },
    })

    if (existingByGithubId && existingByEmail && existingByGithubId.id !== existingByEmail.id) {
      throw new AppError('该 GitHub 账号或邮箱已关联其他账户，请先确认账号归属', 409)
    }

    const targetUser = existingByGithubId || existingByEmail

    if (targetUser) {
      const updatedUser = await prisma.user.update({
        where: { id: targetUser.id },
        data: {
          githubId,
          githubUsername: githubProfile.login,
          emailVerified: true,
          nickname: targetUser.nickname || githubProfile.name || githubProfile.login,
          avatar: targetUser.avatar || githubProfile.avatar_url,
        },
        select: authUserSelect,
      })

      return updatedUser
    }

    const generatedPassword = await hashPassword(randomBytes(24).toString('hex'))
    const createdUser = await prisma.user.create({
      data: {
        email,
        password: generatedPassword,
        nickname: githubProfile.name || githubProfile.login,
        avatar: githubProfile.avatar_url,
        emailVerified: true,
        githubId,
        githubUsername: githubProfile.login,
      },
      select: authUserSelect,
    })

    return createdUser
  }
}
