import type { Prisma } from '@prisma/client'
import { NextFunction, Request, Response } from 'express'
import { prisma } from '../config/database.js'
import { config } from '../config/index.js'
import { AppError } from '../middlewares/errorHandler.js'
import { schoolSearchService } from '../services/school-search.service.js'
import { errorResponse, successResponse } from '../utils/response.js'

interface SchoolSourceListQuery {
  keyword?: string
  schoolName?: string
  isActive?: 'true' | 'false'
}

interface SchoolSourceMutationBody {
  schoolName?: string
  siteName?: string
  baseUrl?: string
  description?: string | null
  priority?: number
  isActive?: boolean
}

const SCHOOL_SOURCE_SELECT = {
  id: true,
  schoolName: true,
  siteName: true,
  baseUrl: true,
  domain: true,
  description: true,
  priority: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SchoolOfficialSourceSelect

/**
 * @description 院校官方源管理控制器。
 */
export class SchoolSourceController {
  /**
   * @description 获取院校官方源列表。
   * @param req 请求对象
   * @param res 响应对象
   * @param next 错误透传
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }

      const query = req.query as SchoolSourceListQuery
      const where: Prisma.SchoolOfficialSourceWhereInput = {}
      const keyword = this.normalizeOptionalString(query.keyword)
      const schoolName = this.normalizeOptionalString(query.schoolName)

      if (schoolName) {
        where.schoolName = {
          contains: schoolName,
        }
      }

      if (query.isActive === 'true') {
        where.isActive = true
      }
      if (query.isActive === 'false') {
        where.isActive = false
      }

      if (keyword) {
        where.AND = [
          {
            OR: [
              { schoolName: { contains: keyword } },
              { siteName: { contains: keyword } },
              { domain: { contains: keyword.toLowerCase() } },
              { description: { contains: keyword } },
            ],
          },
        ]
      }

      const items = await prisma.schoolOfficialSource.findMany({
        where,
        select: SCHOOL_SOURCE_SELECT,
        orderBy: [
          { priority: 'desc' },
          { updatedAt: 'desc' },
        ],
      })

      const schoolCount = new Set(items.map((item) => item.schoolName)).size
      const activeCount = items.filter((item) => item.isActive).length
      const inactiveCount = items.length - activeCount

      return successResponse(res, {
        items,
        canManage: this.isAdminByEmail(req.user.email),
        stats: {
          totalSources: items.length,
          totalSchools: schoolCount,
          activeSources: activeCount,
          inactiveSources: inactiveCount,
        },
      })
    } catch (error) {
      return next(this.normalizePersistenceError(error))
    }
  }

  /**
   * @description 新增院校官方源。
   * @param req 请求对象
   * @param res 响应对象
   * @param next 错误透传
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }
      if (!this.isAdminByEmail(req.user.email)) {
        return errorResponse(res, '仅管理员可维护院校官方源', 403)
      }

      const body = req.body as SchoolSourceMutationBody
      const schoolName = this.normalizeRequiredString(body.schoolName)
      const siteName = this.normalizeRequiredString(body.siteName)
      const baseUrl = this.normalizeUrl(body.baseUrl)
      const description = this.normalizeDescription(body.description)
      const priority = this.normalizePriority(body.priority)
      const domain = this.extractDomain(baseUrl)

      const created = await prisma.schoolOfficialSource.create({
        data: {
          schoolName,
          siteName,
          baseUrl,
          domain,
          description,
          priority,
          isActive: body.isActive ?? true,
        },
        select: SCHOOL_SOURCE_SELECT,
      })

      schoolSearchService.clearCache()
      return successResponse(res, created, '院校官方源已新增')
    } catch (error) {
      return next(this.normalizePersistenceError(error))
    }
  }

  /**
   * @description 更新院校官方源。
   * @param req 请求对象
   * @param res 响应对象
   * @param next 错误透传
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }
      if (!this.isAdminByEmail(req.user.email)) {
        return errorResponse(res, '仅管理员可维护院校官方源', 403)
      }

      const id = String(req.params.id)
      const body = req.body as SchoolSourceMutationBody
      const data: Prisma.SchoolOfficialSourceUpdateInput = {}

      if (body.schoolName !== undefined) {
        data.schoolName = this.normalizeRequiredString(body.schoolName)
      }
      if (body.siteName !== undefined) {
        data.siteName = this.normalizeRequiredString(body.siteName)
      }
      if (body.baseUrl !== undefined) {
        const normalizedUrl = this.normalizeUrl(body.baseUrl)
        data.baseUrl = normalizedUrl
        data.domain = this.extractDomain(normalizedUrl)
      }
      if (body.description !== undefined) {
        data.description = this.normalizeDescription(body.description)
      }
      if (body.priority !== undefined) {
        data.priority = this.normalizePriority(body.priority)
      }
      if (body.isActive !== undefined) {
        data.isActive = body.isActive
      }

      if (Object.keys(data).length === 0) {
        return errorResponse(res, '至少提供一个可更新字段', 400)
      }

      const updated = await prisma.schoolOfficialSource.update({
        where: { id },
        data,
        select: SCHOOL_SOURCE_SELECT,
      })

      schoolSearchService.clearCache()
      return successResponse(res, updated, '院校官方源已更新')
    } catch (error) {
      return next(this.normalizePersistenceError(error))
    }
  }

  /**
   * @description 删除院校官方源。
   * @param req 请求对象
   * @param res 响应对象
   * @param next 错误透传
   */
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }
      if (!this.isAdminByEmail(req.user.email)) {
        return errorResponse(res, '仅管理员可维护院校官方源', 403)
      }

      const id = String(req.params.id)
      await prisma.schoolOfficialSource.delete({
        where: { id },
      })

      schoolSearchService.clearCache()
      return successResponse(res, null, '院校官方源已删除')
    } catch (error) {
      return next(this.normalizePersistenceError(error))
    }
  }

  /**
   * @description 标准化必填字符串。
   * @param value 输入值
   * @returns 标准化后的字符串
   */
  private normalizeRequiredString(value: string | undefined): string {
    const normalized = this.normalizeOptionalString(value)
    if (!normalized) {
      throw new AppError('必填字段不能为空', 400)
    }
    return normalized
  }

  /**
   * @description 标准化可选字符串。
   * @param value 输入值
   * @returns 标准化后的字符串
   */
  private normalizeOptionalString(value: string | undefined): string | null {
    if (typeof value !== 'string') {
      return null
    }

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  /**
   * @description 标准化描述字段。
   * @param value 输入值
   * @returns 标准化后的描述
   */
  private normalizeDescription(value: string | null | undefined): string | null {
    if (value === null) {
      return null
    }
    return this.normalizeOptionalString(value ?? undefined)
  }

  /**
   * @description 标准化链接并校验协议。
   * @param value 原始链接
   * @returns 标准化后的链接
   */
  private normalizeUrl(value: string | undefined): string {
    if (typeof value !== 'string') {
      throw new AppError('链接不能为空', 400)
    }

    const raw = value.trim()
    const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`

    const parsed = new URL(withProtocol)
    parsed.hash = ''
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new AppError('仅支持 http/https 链接', 400)
    }
    return parsed.toString()
  }

  /**
   * @description 标准化优先级。
   * @param value 原始优先级
   * @returns 规范化后的优先级
   */
  private normalizePriority(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 100
    }
    return Math.max(0, Math.min(9999, Math.floor(value)))
  }

  /**
   * @description 提取域名。
   * @param value 官方链接
   * @returns 归一化域名
   */
  private extractDomain(value: string): string {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '')
  }

  /**
   * @description 判断是否为管理员。
   * @param email 当前用户邮箱
   * @returns 是否管理员
   */
  private isAdminByEmail(email: string): boolean {
    return config.forumAdminEmails.includes(email.trim().toLowerCase())
  }

  /**
   * @description 归一化 Prisma 持久化异常。
   * @param error 原始异常
   * @returns 可直接透传的异常对象
   */
  private normalizePersistenceError(error: unknown): unknown {
    if (error instanceof AppError) {
      return error
    }

    const prismaError = error as { code?: string }
    if (prismaError?.code === 'P2002') {
      return new AppError('该官方源链接已存在，请勿重复添加', 409)
    }
    if (prismaError?.code === 'P2025') {
      return new AppError('目标院校官方源不存在', 404)
    }
    return error
  }
}
