import type { Prisma } from '@prisma/client'
import { NextFunction, Request, Response } from 'express'
import { prisma } from '../config/database.js'
import { config } from '../config/index.js'
import { runSingleHealthCheck, runUserHealthCheck } from '../services/resource-health.service.js'
import { errorResponse, successResponse } from '../utils/response.js'

interface ResourceLinkBody {
  title?: unknown
  url?: unknown
  category?: unknown
  description?: unknown
  isPinned?: unknown
  pinned?: unknown
}

interface ResourceBatchBody {
  items?: unknown
}

interface ResourceBatchItemInput {
  title?: unknown
  url?: unknown
  category?: unknown
  description?: unknown
  isPinned?: unknown
}

interface ResourceBatchItemPayload {
  title: string
  url: string
  category: string
  description: string | null
  isPinned: boolean
}

interface ResourceListQuery {
  keyword?: unknown
  category?: unknown
  pinned?: unknown
  sort?: unknown
}

interface CategoryCounter {
  category: string
  count: number
}

interface BatchInvalidItem {
  index: number
  reason: string
}

interface CategoryMutationBody {
  fromCategory?: unknown
  toCategory?: unknown
}

interface ResourceHealthBatchBody {
  ids?: unknown
}

interface ResourceHealthReportQuery {
  triggerType?: unknown
}

type ResourceSortType = 'updated' | 'created' | 'visited' | 'popular'

const DEFAULT_CATEGORY = '未分类'
const MAX_BATCH_IMPORT = 100

/**
 * @description 将输入值转换为非空标题。
 * @param value 输入值
 * @returns 标准化后的标题
 */
function toRequiredTitle(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const title = value.trim()
  return title.length > 0 ? title : null
}

/**
 * @description 将输入值转换为可空描述。
 * @param value 输入值
 * @returns 标准化后的描述
 */
function toNullableDescription(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const description = value.trim()
  return description.length > 0 ? description : null
}

/**
 * @description 将输入值转换为有效分类。
 * @param value 输入值
 * @returns 标准化后的分类名
 */
function toCategory(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_CATEGORY
  }

  const category = value.trim()
  if (!category) {
    return DEFAULT_CATEGORY
  }

  if (category.length > 30) {
    return category.slice(0, 30)
  }

  return category
}

/**
 * @description 将输入值转换为严格分类名。
 * @param value 输入值
 * @returns 标准化后的分类名，非法时返回 null
 */
function toRequiredCategoryName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const category = value.trim()
  if (!category) {
    return null
  }

  if (category.length > 30) {
    return category.slice(0, 30)
  }
  return category
}

/**
 * @description 归一化并校验 URL，自动补全协议。
 * @param value 输入值
 * @returns 标准化后的 URL
 */
function toNormalizedUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const raw = value.trim()
  if (!raw) {
    return null
  }

  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`

  try {
    const parsed = new URL(withProtocol)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * @description 将输入值解析为布尔值。
 * @param value 输入值
 * @returns 解析后的布尔值，无法解析时返回 null
 */
function toNullableBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') {
      return true
    }
    if (normalized === 'false') {
      return false
    }
  }
  return null
}

/**
 * @description 将输入值解析为关键字。
 * @param value 输入值
 * @returns 标准化关键字
 */
function toKeyword(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const keyword = value.trim()
  return keyword.length > 0 ? keyword : null
}

/**
 * @description 解析排序类型。
 * @param value 输入值
 * @returns 排序类型
 */
function toSortType(value: unknown): ResourceSortType {
  if (typeof value !== 'string') {
    return 'updated'
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === 'created') {
    return 'created'
  }
  if (normalized === 'visited') {
    return 'visited'
  }
  if (normalized === 'popular') {
    return 'popular'
  }
  return 'updated'
}

/**
 * @description 解析批量导入的单条数据。
 * @param value 输入值
 * @returns 标准化结果或失败原因
 */
function parseBatchItem(
  value: unknown
): { payload: ResourceBatchItemPayload } | { reason: string } {
  if (!value || typeof value !== 'object') {
    return { reason: '数据格式错误' }
  }

  const item = value as ResourceBatchItemInput
  const title = toRequiredTitle(item.title)
  if (!title) {
    return { reason: '标题不能为空' }
  }

  const url = toNormalizedUrl(item.url)
  if (!url) {
    return { reason: '链接地址格式不正确' }
  }

  const isPinned = toNullableBoolean(item.isPinned) ?? false

  return {
    payload: {
      title,
      url,
      category: toCategory(item.category),
      description: toNullableDescription(item.description),
      isPinned,
    },
  }
}

/**
 * @description 解析链接 ID 数组。
 * @param value 输入值
 * @returns 解析后的 ID 数组，输入非法时返回 null
 */
function toIdList(value: unknown): string[] | null {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    return null
  }

  const result = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  return Array.from(new Set(result))
}

/**
 * @description 解析报告触发类型。
 * @param value 输入值
 * @returns 触发类型，不筛选时返回 null
 */
function toTriggerType(value: unknown): 'MANUAL' | 'SCHEDULED' | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toUpperCase()
  if (normalized === 'MANUAL' || normalized === 'SCHEDULED') {
    return normalized
  }
  return null
}

/**
 * @description 获取列表排序规则。
 * @param sort 排序类型
 * @returns Prisma 排序数组
 */
function resolveOrderBy(sort: ResourceSortType): Prisma.ResourceLinkOrderByWithRelationInput[] {
  if (sort === 'created') {
    return [{ createdAt: 'desc' }]
  }
  if (sort === 'visited') {
    return [{ lastVisitedAt: 'desc' }, { updatedAt: 'desc' }]
  }
  if (sort === 'popular') {
    return [{ visitCount: 'desc' }, { updatedAt: 'desc' }]
  }
  return [{ updatedAt: 'desc' }]
}

export class ResourceController {
  /** @description 获取资料链接列表，支持搜索/分类/置顶筛选与排序 */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }
      const userId = req.user.id

      const query = req.query as ResourceListQuery
      const keyword = toKeyword(query.keyword)
      const categoryKeyword = toKeyword(query.category)
      const pinned = toNullableBoolean(query.pinned)
      const sort = toSortType(query.sort)

      const where: Prisma.ResourceLinkWhereInput = {
        userId,
      }

      if (keyword) {
        where.OR = [
          { title: { contains: keyword } },
          { description: { contains: keyword } },
          { url: { contains: keyword } },
        ]
      }

      if (categoryKeyword) {
        where.category = categoryKeyword
      }

      if (pinned !== null) {
        where.isPinned = pinned
      }

      const list = await prisma.resourceLink.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, ...resolveOrderBy(sort)],
      })

      return successResponse(res, list)
    } catch (error) {
      return next(error)
    }
  }

  /** @description 获取分类统计 */
  async categories(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }
      const userId = req.user.id

      const categories = await prisma.resourceLink.findMany({
        where: { userId },
        select: { category: true },
      })

      const categoryMap = new Map<string, number>()
      for (const item of categories) {
        categoryMap.set(item.category, (categoryMap.get(item.category) ?? 0) + 1)
      }

      const result: CategoryCounter[] = Array.from(categoryMap.entries()).map(([category, count]) => ({
        category,
        count,
      }))

      result.sort((left, right) => {
        if (left.category === DEFAULT_CATEGORY) return 1
        if (right.category === DEFAULT_CATEGORY) return -1
        return left.category.localeCompare(right.category, 'zh-CN')
      })

      return successResponse(res, result)
    } catch (error) {
      return next(error)
    }
  }

  /** @description 获取最新巡检报告 */
  async latestHealthReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }
      const userId = req.user.id

      const query = req.query as ResourceHealthReportQuery
      const triggerType = toTriggerType(query.triggerType)
      const where: Prisma.ResourceHealthReportWhereInput = {
        userId,
      }
      if (triggerType) {
        where.triggerType = triggerType
      }

      const report = await prisma.resourceHealthReport.findFirst({
        where,
        orderBy: { createdAt: 'desc' },
      })

      return successResponse(res, report)
    } catch (error) {
      return next(error)
    }
  }

  /** @description 重命名分类 */
  async renameCategory(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }
      const userId = req.user.id

      const body = req.body as CategoryMutationBody
      const fromCategory = toRequiredCategoryName(body.fromCategory)
      const toCategory = toRequiredCategoryName(body.toCategory)

      if (!fromCategory || !toCategory) {
        return errorResponse(res, 'fromCategory 与 toCategory 均不能为空', 400)
      }
      if (fromCategory === toCategory) {
        return errorResponse(res, '新旧分类不能相同', 400)
      }

      const fromCount = await prisma.resourceLink.count({
        where: { userId, category: fromCategory },
      })
      if (fromCount === 0) {
        return errorResponse(res, '源分类不存在或没有链接', 404)
      }

      const targetCount = await prisma.resourceLink.count({
        where: { userId, category: toCategory },
      })
      if (targetCount > 0) {
        return errorResponse(res, '目标分类已存在，请使用合并分类', 400)
      }

      const updated = await prisma.resourceLink.updateMany({
        where: { userId, category: fromCategory },
        data: { category: toCategory },
      })

      return successResponse(
        res,
        {
          fromCategory,
          toCategory,
          updatedCount: updated.count,
        },
        '分类重命名成功'
      )
    } catch (error) {
      return next(error)
    }
  }

  /** @description 合并分类 */
  async mergeCategory(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }
      const userId = req.user.id

      const body = req.body as CategoryMutationBody
      const fromCategory = toRequiredCategoryName(body.fromCategory)
      const toCategory = toRequiredCategoryName(body.toCategory)

      if (!fromCategory || !toCategory) {
        return errorResponse(res, 'fromCategory 与 toCategory 均不能为空', 400)
      }
      if (fromCategory === toCategory) {
        return errorResponse(res, '源分类与目标分类不能相同', 400)
      }

      const fromCount = await prisma.resourceLink.count({
        where: { userId, category: fromCategory },
      })
      if (fromCount === 0) {
        return errorResponse(res, '源分类不存在或没有链接', 404)
      }

      const targetCount = await prisma.resourceLink.count({
        where: { userId, category: toCategory },
      })

      const updated = await prisma.resourceLink.updateMany({
        where: { userId, category: fromCategory },
        data: { category: toCategory },
      })

      return successResponse(
        res,
        {
          fromCategory,
          toCategory,
          movedCount: updated.count,
          targetBeforeMerge: targetCount,
          targetAfterMerge: targetCount + updated.count,
        },
        '分类合并成功'
      )
    } catch (error) {
      return next(error)
    }
  }

  /** @description 获取资料链接详情 */
  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }
      const userId = req.user.id

      const item = await prisma.resourceLink.findFirst({
        where: {
          id: String(req.params.id),
          userId,
        },
      })

      if (!item) {
        return errorResponse(res, '资料链接不存在', 404)
      }

      return successResponse(res, item)
    } catch (error) {
      return next(error)
    }
  }

  /** @description 创建资料链接 */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }
      const userId = req.user.id

      const body = req.body as ResourceLinkBody
      const title = toRequiredTitle(body.title)
      const url = toNormalizedUrl(body.url)

      if (!title) {
        return errorResponse(res, '标题不能为空', 400)
      }

      if (!url) {
        return errorResponse(res, '链接地址格式不正确', 400)
      }

      const isPinned = toNullableBoolean(body.isPinned) ?? false

      const item = await prisma.resourceLink.create({
        data: {
          userId,
          title,
          url,
          category: toCategory(body.category),
          description: toNullableDescription(body.description),
          isPinned,
        },
      })

      return successResponse(res, item, '创建成功')
    } catch (error) {
      return next(error)
    }
  }

  /** @description 批量创建资料链接 */
  async batchCreate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }
      const userId = req.user.id

      const body = req.body as ResourceBatchBody
      if (!Array.isArray(body.items)) {
        return errorResponse(res, 'items 必须是数组', 400)
      }

      if (body.items.length === 0) {
        return errorResponse(res, '请至少提供一条导入数据', 400)
      }

      if (body.items.length > MAX_BATCH_IMPORT) {
        return errorResponse(res, `单次最多导入 ${MAX_BATCH_IMPORT} 条`, 400)
      }

      const normalizedItems: ResourceBatchItemPayload[] = []
      const invalidItems: BatchInvalidItem[] = []
      const requestUrlSet = new Set<string>()
      let duplicateInRequest = 0

      body.items.forEach((rawItem, index) => {
        const parsedItem = parseBatchItem(rawItem)
        if ('reason' in parsedItem) {
          invalidItems.push({ index: index + 1, reason: parsedItem.reason })
          return
        }

        if (requestUrlSet.has(parsedItem.payload.url)) {
          duplicateInRequest += 1
          return
        }

        requestUrlSet.add(parsedItem.payload.url)
        normalizedItems.push(parsedItem.payload)
      })

      if (normalizedItems.length === 0) {
        return errorResponse(res, '没有可导入的有效链接', 400)
      }

      const existingRows = await prisma.resourceLink.findMany({
        where: {
          userId,
          url: {
            in: normalizedItems.map((item) => item.url),
          },
        },
        select: {
          url: true,
        },
      })
      const existingUrlSet = new Set(existingRows.map((item) => item.url))

      const createData: Prisma.ResourceLinkCreateManyInput[] = normalizedItems
        .filter((item) => !existingUrlSet.has(item.url))
        .map((item) => ({
          userId,
          title: item.title,
          url: item.url,
          category: item.category,
          description: item.description,
          isPinned: item.isPinned,
        }))

      if (createData.length > 0) {
        await prisma.resourceLink.createMany({
          data: createData,
        })
      }

      const duplicateInDatabase = normalizedItems.length - createData.length
      const result = {
        total: body.items.length,
        createdCount: createData.length,
        duplicateCount: duplicateInRequest + duplicateInDatabase,
        invalidCount: invalidItems.length,
        invalidItems: invalidItems.slice(0, 20),
      }

      const message = createData.length > 0 ? '批量导入完成' : '没有新增资料链接'
      return successResponse(res, result, message)
    } catch (error) {
      return next(error)
    }
  }

  /** @description 更新资料链接 */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }
      const userId = req.user.id

      const id = String(req.params.id)
      const exists = await prisma.resourceLink.findFirst({
        where: { id, userId },
        select: { id: true },
      })

      if (!exists) {
        return errorResponse(res, '资料链接不存在', 404)
      }

      const body = req.body as ResourceLinkBody
      const data: Prisma.ResourceLinkUpdateInput = {}

      if (body.title !== undefined) {
        const title = toRequiredTitle(body.title)
        if (!title) {
          return errorResponse(res, '标题不能为空', 400)
        }
        data.title = title
      }

      if (body.url !== undefined) {
        const url = toNormalizedUrl(body.url)
        if (!url) {
          return errorResponse(res, '链接地址格式不正确', 400)
        }
        data.url = url
        data.healthStatus = 'UNKNOWN'
        data.lastCheckedAt = null
        data.lastCheckStatusCode = null
      }

      if (body.category !== undefined) {
        data.category = toCategory(body.category)
      }

      if (body.description !== undefined) {
        data.description = toNullableDescription(body.description)
      }

      if (body.isPinned !== undefined) {
        const isPinned = toNullableBoolean(body.isPinned)
        if (isPinned === null) {
          return errorResponse(res, '置顶字段格式不正确', 400)
        }
        data.isPinned = isPinned
      }

      if (Object.keys(data).length === 0) {
        return errorResponse(res, '至少提供一个可更新字段', 400)
      }

      const item = await prisma.resourceLink.update({
        where: { id },
        data,
      })

      return successResponse(res, item, '更新成功')
    } catch (error) {
      return next(error)
    }
  }

  /** @description 更新置顶状态 */
  async togglePin(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }
      const userId = req.user.id

      const id = String(req.params.id)
      const body = req.body as ResourceLinkBody
      const targetPinned = toNullableBoolean(body.pinned ?? body.isPinned)

      if (targetPinned === null) {
        return errorResponse(res, '请提供 pinned 布尔值', 400)
      }

      const exists = await prisma.resourceLink.findFirst({
        where: { id, userId },
        select: { id: true },
      })

      if (!exists) {
        return errorResponse(res, '资料链接不存在', 404)
      }

      const item = await prisma.resourceLink.update({
        where: { id },
        data: { isPinned: targetPinned },
      })

      return successResponse(res, item, targetPinned ? '已置顶' : '已取消置顶')
    } catch (error) {
      return next(error)
    }
  }

  /** @description 记录资料链接访问 */
  async recordVisit(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }
      const userId = req.user.id

      const id = String(req.params.id)
      const exists = await prisma.resourceLink.findFirst({
        where: { id, userId },
        select: { id: true },
      })
      if (!exists) {
        return errorResponse(res, '资料链接不存在', 404)
      }

      const item = await prisma.resourceLink.update({
        where: { id },
        data: {
          visitCount: { increment: 1 },
          lastVisitedAt: new Date(),
        },
      })

      return successResponse(res, item, '访问记录已更新')
    } catch (error) {
      return next(error)
    }
  }

  /** @description 检测单条资料链接可用性 */
  async checkHealth(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }
      const userId = req.user.id

      const id = String(req.params.id)
      const updatedItem = await runSingleHealthCheck(userId, id, config.resourceHealthTimeoutMs)
      if (!updatedItem) {
        return errorResponse(res, '资料链接不存在', 404)
      }

      const message = updatedItem.healthStatus === 'AVAILABLE' ? '链接可用' : '链接可能失效'
      return successResponse(res, updatedItem, message)
    } catch (error) {
      return next(error)
    }
  }

  /** @description 批量检测资料链接可用性 */
  async checkHealthBatch(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }
      const userId = req.user.id

      const body = req.body as ResourceHealthBatchBody
      const ids = toIdList(body.ids)
      if (ids === null) {
        return errorResponse(res, 'ids 必须是字符串数组', 400)
      }
      const result = await runUserHealthCheck({
        userId,
        ids: ids.length > 0 ? ids : undefined,
        maxCheckCount: config.resourceHealthMaxCheckPerUser,
        triggerType: 'MANUAL',
        timeoutMs: config.resourceHealthTimeoutMs,
      })

      const message = result.checkedCount > 0 ? '批量检测完成' : '没有可检测的资料链接'
      return successResponse(
        res,
        {
          totalCount: result.totalCount,
          checkedCount: result.checkedCount,
          availableCount: result.availableCount,
          unavailableCount: result.unavailableCount,
          unknownCount: result.unknownCount,
          skippedCount: result.skippedCount,
          reportId: result.report.id,
          reportCreatedAt: result.report.createdAt,
          triggerType: result.report.triggerType,
        },
        message
      )
    } catch (error) {
      return next(error)
    }
  }

  /** @description 删除资料链接 */
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }
      const userId = req.user.id

      const id = String(req.params.id)
      const exists = await prisma.resourceLink.findFirst({
        where: { id, userId },
        select: { id: true },
      })

      if (!exists) {
        return errorResponse(res, '资料链接不存在', 404)
      }

      await prisma.resourceLink.delete({
        where: { id },
      })

      return successResponse(res, null, '删除成功')
    } catch (error) {
      return next(error)
    }
  }
}
