import { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/database.js'
import { config } from '../config/index.js'
import { AppError } from '../middlewares/errorHandler.js'
import { comparePassword, hashPassword } from '../utils/password.js'
import { error, success } from '../utils/response.js'
import { generateToken, verifyGithubStateToken } from '../utils/token.js'
import { AuthService } from '../services/auth.service.js'

const authService = new AuthService()

export class AuthController {
  /** 用户注册 */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, nickname, verificationCode } = req.body as {
        email: string
        password: string
        nickname?: string
        verificationCode: string
      }
      const result = await authService.register(email, password, verificationCode, nickname)
      return success(res, result, '注册成功')
    } catch (err) {
      if (err instanceof AppError) {
        return error(res, err.message, err.statusCode)
      }
      return next(err)
    }
  }

  /** 发送注册验证码 */
  async sendRegisterCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body as {
        email: string
      }
      const result = await authService.sendRegisterCode(email)
      return success(res, result, '验证码已发送，请注意查收邮箱')
    } catch (err) {
      if (err instanceof AppError) {
        return error(res, err.message, err.statusCode)
      }
      return next(err)
    }
  }

  /** 发送重置密码验证码 */
  async sendResetPasswordCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body as {
        email: string
      }
      const result = await authService.sendResetPasswordCode(email)
      return success(res, result, '如该邮箱已注册，验证码已发送，请注意查收邮箱')
    } catch (err) {
      if (err instanceof AppError) {
        return error(res, err.message, err.statusCode)
      }
      return next(err)
    }
  }

  /** 重置密码 */
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, verificationCode, newPassword } = req.body as {
        email: string
        verificationCode: string
        newPassword: string
      }
      await authService.resetPassword(email, verificationCode, newPassword)
      return success(res, null, '密码重置成功，请使用新密码登录')
    } catch (err) {
      if (err instanceof AppError) {
        return error(res, err.message, err.statusCode)
      }
      return next(err)
    }
  }

  /** 用户登录 */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body as {
        email: string
        password: string
      }
      const result = await authService.login(email, password)
      return success(res, result, '登录成功')
    } catch (err) {
      if (err instanceof AppError) {
        return error(res, err.message, err.statusCode)
      }
      return next(err)
    }
  }

  /** GitHub OAuth 授权入口 */
  async githubAuthorize(req: Request, res: Response, next: NextFunction) {
    const entry = this.resolveEntry(req.query.entry)

    try {
      const redirect = typeof req.query.redirect === 'string' ? req.query.redirect : undefined
      const authorizeUrl = authService.getGithubAuthorizeUrl(redirect, entry)
      return res.redirect(authorizeUrl)
    } catch (err) {
      if (err instanceof AppError) {
        return res.redirect(this.buildEntryRedirectUrl(entry, err.message))
      }
      return next(err)
    }
  }

  /** GitHub OAuth 回调 */
  async githubCallback(req: Request, res: Response, next: NextFunction) {
    const entry = this.resolveEntryFromState(req.query.state)

    try {
      if (typeof req.query.error === 'string') {
        const errorMessage = typeof req.query.error_description === 'string'
          ? req.query.error_description
          : 'GitHub 登录已取消'
        return res.redirect(this.buildEntryRedirectUrl(entry, errorMessage))
      }

      const code = typeof req.query.code === 'string' ? req.query.code : ''
      const state = typeof req.query.state === 'string' ? req.query.state : ''

      if (!code || !state) {
        return res.redirect(this.buildEntryRedirectUrl(entry, '缺少 GitHub 授权参数，请重新尝试'))
      }

      const result = await authService.handleGithubCallback(code, state)
      return res.redirect(this.buildGithubSuccessRedirectUrl(result.token, result.redirectTo))
    } catch (err) {
      if (err instanceof AppError) {
        return res.redirect(this.buildEntryRedirectUrl(entry, err.message))
      }
      return next(err)
    }
  }

  /** 获取当前用户信息 */
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return error(res, '未登录', 401)
      }

      const userId = req.user.id
      const user = await authService.getUserById(userId)
      return success(res, user, '获取用户信息成功')
    } catch (err) {
      if (err instanceof AppError) {
        return error(res, err.message, err.statusCode)
      }
      return next(err)
    }
  }

  /** 更新用户资料 */
  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return error(res, '未登录', 401)
      }

      const userId = req.user.id
      const { nickname, avatar } = req.body as {
        nickname?: string
        avatar?: string
      }

      const data: {
        nickname?: string
        avatar?: string
      } = {}

      if (nickname !== undefined) {
        data.nickname = nickname
      }
      if (avatar !== undefined) {
        data.avatar = avatar
      }

      if (Object.keys(data).length === 0) {
        return error(res, '至少提供一个可更新字段', 400)
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          email: true,
          nickname: true,
          avatar: true,
          emailVerified: true,
          githubUsername: true,
          createdAt: true,
        },
      })

      return success(res, user, '资料更新成功')
    } catch (err) {
      if (err instanceof AppError) {
        return error(res, err.message, err.statusCode)
      }
      return next(err)
    }
  }

  /** 修改密码 */
  async updatePassword(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return error(res, '未登录', 401)
      }

      const userId = req.user.id
      const { oldPassword, newPassword } = req.body as {
        oldPassword: string
        newPassword: string
      }

      if (!oldPassword || !newPassword) {
        return error(res, '旧密码和新密码不能为空', 400)
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user) {
        return error(res, '用户不存在', 404)
      }

      const isValidOldPassword = await comparePassword(oldPassword, user.password)
      if (!isValidOldPassword) {
        return error(res, '旧密码错误', 400)
      }

      const hashedNewPassword = await hashPassword(newPassword)
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedNewPassword,
          tokenVersion: {
            increment: 1,
          },
        },
        select: {
          id: true,
          email: true,
          tokenVersion: true,
        },
      })

      const refreshedToken = generateToken({
        id: updatedUser.id,
        email: updatedUser.email,
        tokenVersion: updatedUser.tokenVersion,
      })

      return success(res, { token: refreshedToken }, '密码修改成功')
    } catch (err) {
      if (err instanceof AppError) {
        return error(res, err.message, err.statusCode)
      }
      return next(err)
    }
  }

  /** 注销账号 */
  async deleteAccount(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return error(res, '未登录', 401)
      }

      const userId = req.user.id

      await prisma.$transaction(async (tx) => {
        const professors = await tx.professor.findMany({
          where: { userId },
          select: { id: true },
        })

        const professorIds = professors.map((professor) => professor.id)

        if (professorIds.length > 0) {
          await tx.interview.deleteMany({
            where: {
              professorId: { in: professorIds },
            },
          })

          await tx.tagOnProfessor.deleteMany({
            where: {
              professorId: { in: professorIds },
            },
          })
        }

        await tx.note.deleteMany({ where: { userId } })
        await tx.reminder.deleteMany({ where: { userId } })
        await tx.emailTemplate.deleteMany({ where: { userId } })
        await tx.resourceLink.deleteMany({ where: { userId } })
        await tx.resourceHealthReport.deleteMany({ where: { userId } })
        await tx.tag.deleteMany({ where: { userId } })
        await tx.professor.deleteMany({ where: { userId } })
        await tx.user.delete({ where: { id: userId } })
      })

      return success(res, null, '账号注销成功')
    } catch (err) {
      if (err instanceof AppError) {
        return error(res, err.message, err.statusCode)
      }
      return next(err)
    }
  }

  /** 用户登出 */
  async logout(_req: Request, res: Response) {
    return success(res, null, '退出登录成功')
  }

  /**
   * @description 解析入口页面。
   * @param rawEntry 原始入口值
   * @returns 入口页面
   */
  private resolveEntry(rawEntry: unknown): 'login' | 'register' {
    return rawEntry === 'register' ? 'register' : 'login'
  }

  /**
   * @description 尝试从 GitHub state 中恢复入口页面。
   * @param rawState 原始 state
   * @returns 入口页面
   */
  private resolveEntryFromState(rawState: unknown): 'login' | 'register' {
    if (typeof rawState !== 'string' || !rawState) {
      return 'login'
    }

    try {
      return verifyGithubStateToken(rawState).entry
    } catch {
      return 'login'
    }
  }

  /**
   * @description 构建前端页面跳转地址。
   * @param pathname 页面路径
   * @param searchParams 查询参数
   * @returns 完整地址
   */
  private buildFrontendUrl(pathname: string, searchParams: Record<string, string>) {
    const url = new URL(pathname, config.appBaseUrl)

    Object.entries(searchParams).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value)
      }
    })

    return url.toString()
  }

  /**
   * @description 构建 GitHub 登录成功后的前端跳转地址。
   * @param token 登录令牌
   * @param redirectTo 登录后的目标路径
   * @returns 跳转地址
   */
  private buildGithubSuccessRedirectUrl(token: string, redirectTo: string) {
    return this.buildFrontendUrl('/login', {
      token,
      redirect: redirectTo,
      provider: 'github',
    })
  }

  /**
   * @description 构建授权失败后的页面跳转地址。
   * @param entry 来源页面
   * @param authError 错误消息
   * @returns 跳转地址
   */
  private buildEntryRedirectUrl(entry: 'login' | 'register', authError: string) {
    return this.buildFrontendUrl(entry === 'register' ? '/register' : '/login', {
      authError,
    })
  }
}
