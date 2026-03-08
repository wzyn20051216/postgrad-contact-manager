import type { Prisma, ResourceLink, ResourceHealthReport } from '@prisma/client'
import { prisma } from '../config/database.js'

export type ResourceHealthStatus = 'UNKNOWN' | 'AVAILABLE' | 'UNAVAILABLE'
export type HealthCheckTriggerType = 'MANUAL' | 'SCHEDULED'

export interface UrlHealthCheckResult {
  healthStatus: ResourceHealthStatus
  statusCode: number | null
}

export interface UserHealthCheckSummary {
  totalCount: number
  checkedCount: number
  availableCount: number
  unavailableCount: number
  unknownCount: number
  skippedCount: number
  report: ResourceHealthReport
}

export interface GlobalHealthCheckSummary {
  userCount: number
  totalCheckedCount: number
  totalAvailableCount: number
  totalUnavailableCount: number
  totalUnknownCount: number
  totalSkippedCount: number
}

const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 8000

/**
 * @description 判断是否为私有网段 IPv4。
 * @param hostname 主机名
 * @returns 是否私有 IPv4
 */
function isPrivateIpv4(hostname: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return false
  }

  const parts = hostname.split('.').map((item) => Number(item))
  if (parts.some((item) => Number.isNaN(item) || item < 0 || item > 255)) {
    return true
  }

  const [first, second] = parts
  if (first === 10) return true
  if (first === 127) return true
  if (first === 0) return true
  if (first === 169 && second === 254) return true
  if (first === 172 && second >= 16 && second <= 31) return true
  if (first === 192 && second === 168) return true
  return false
}

/**
 * @description 判断主机是否应跳过探测。
 * @param urlValue 链接地址
 * @returns 是否跳过
 */
function shouldSkipHealthCheck(urlValue: string): boolean {
  try {
    const parsed = new URL(urlValue)
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')

    if (hostname === 'localhost' || hostname.endsWith('.local')) {
      return true
    }
    if (hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd')) {
      return true
    }
    if (
      hostname.startsWith('fe8') ||
      hostname.startsWith('fe9') ||
      hostname.startsWith('fea') ||
      hostname.startsWith('feb')
    ) {
      return true
    }
    if (isPrivateIpv4(hostname)) {
      return true
    }
    return false
  } catch {
    return true
  }
}

/**
 * @description 请求 URL 并返回状态码。
 * @param urlValue 链接地址
 * @param method 请求方法
 * @param timeoutMs 超时时间（毫秒）
 * @returns HTTP 状态码，失败时返回 null
 */
async function requestStatusCode(
  urlValue: string,
  method: 'HEAD' | 'GET',
  timeoutMs: number
): Promise<number | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(urlValue, {
      method,
      redirect: 'follow',
      signal: controller.signal,
    })
    return response.status
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @description 根据状态码映射健康状态。
 * @param statusCode 状态码
 * @returns 健康状态
 */
function toHealthStatusByCode(statusCode: number | null): ResourceHealthStatus {
  if (statusCode === null) {
    return 'UNAVAILABLE'
  }
  if (statusCode >= 200 && statusCode < 400) {
    return 'AVAILABLE'
  }
  return 'UNAVAILABLE'
}

/**
 * @description 检测链接可用性。
 * @param urlValue 链接地址
 * @param timeoutMs 超时时间（毫秒）
 * @returns 探测结果
 */
export async function detectUrlHealth(
  urlValue: string,
  timeoutMs: number = DEFAULT_HEALTH_CHECK_TIMEOUT_MS
): Promise<UrlHealthCheckResult> {
  if (shouldSkipHealthCheck(urlValue)) {
    return {
      healthStatus: 'UNKNOWN',
      statusCode: null,
    }
  }

  const headStatus = await requestStatusCode(urlValue, 'HEAD', timeoutMs)
  let finalStatus = headStatus

  if (headStatus === 405 || headStatus === 501 || headStatus === null) {
    const getStatus = await requestStatusCode(urlValue, 'GET', timeoutMs)
    if (getStatus !== null) {
      finalStatus = getStatus
    }
  }

  return {
    healthStatus: toHealthStatusByCode(finalStatus),
    statusCode: finalStatus,
  }
}

/**
 * @description 检测并更新单条资料链接可用性。
 * @param item 资料链接数据
 * @param timeoutMs 超时时间（毫秒）
 * @returns 更新后的资料链接
 */
async function checkAndUpdateOne(item: Pick<ResourceLink, 'id' | 'url'>, timeoutMs: number): Promise<ResourceLink> {
  const healthResult = await detectUrlHealth(item.url, timeoutMs)

  return prisma.resourceLink.update({
    where: { id: item.id },
    data: {
      healthStatus: healthResult.healthStatus,
      lastCheckedAt: new Date(),
      lastCheckStatusCode: healthResult.statusCode,
    },
  })
}

/**
 * @description 检测指定用户的单条链接。
 * @param userId 用户 ID
 * @param resourceId 资料链接 ID
 * @param timeoutMs 超时时间（毫秒）
 * @returns 更新后的资料链接，不存在时返回 null
 */
export async function runSingleHealthCheck(
  userId: string,
  resourceId: string,
  timeoutMs: number = DEFAULT_HEALTH_CHECK_TIMEOUT_MS
): Promise<ResourceLink | null> {
  const item = await prisma.resourceLink.findFirst({
    where: { id: resourceId, userId },
    select: {
      id: true,
      url: true,
    },
  })
  if (!item) {
    return null
  }

  return checkAndUpdateOne(item, timeoutMs)
}

/**
 * @description 为指定用户运行批量链接检测并生成报告。
 * @param params 检测参数
 * @returns 检测汇总
 */
export async function runUserHealthCheck(params: {
  userId: string
  ids?: string[]
  maxCheckCount: number
  triggerType: HealthCheckTriggerType
  timeoutMs?: number
}): Promise<UserHealthCheckSummary> {
  const startedAt = new Date()
  const timeoutMs = params.timeoutMs ?? DEFAULT_HEALTH_CHECK_TIMEOUT_MS

  const where: Prisma.ResourceLinkWhereInput = {
    userId: params.userId,
  }
  if (params.ids && params.ids.length > 0) {
    where.id = { in: params.ids }
  }

  const totalCount = await prisma.resourceLink.count({ where })
  const list = await prisma.resourceLink.findMany({
    where,
    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    take: Math.max(params.maxCheckCount, 1),
    select: {
      id: true,
      url: true,
    },
  })

  let availableCount = 0
  let unavailableCount = 0
  let unknownCount = 0

  for (const item of list) {
    const updated = await checkAndUpdateOne(item, timeoutMs)

    if (updated.healthStatus === 'AVAILABLE') {
      availableCount += 1
    } else if (updated.healthStatus === 'UNAVAILABLE') {
      unavailableCount += 1
    } else {
      unknownCount += 1
    }
  }

  const checkedCount = list.length
  const skippedCount = Math.max(totalCount - checkedCount, 0)
  const finishedAt = new Date()

  const report = await prisma.resourceHealthReport.create({
    data: {
      userId: params.userId,
      triggerType: params.triggerType,
      totalCount,
      checkedCount,
      availableCount,
      unavailableCount,
      unknownCount,
      skippedCount,
      startedAt,
      finishedAt,
    },
  })

  return {
    totalCount,
    checkedCount,
    availableCount,
    unavailableCount,
    unknownCount,
    skippedCount,
    report,
  }
}

/**
 * @description 运行全站定时巡检（按用户分批）。
 * @param params 调度参数
 * @returns 全局检测汇总
 */
export async function runGlobalScheduledHealthCheck(params: {
  maxCheckPerUser: number
  timeoutMs?: number
}): Promise<GlobalHealthCheckSummary> {
  const users = await prisma.user.findMany({
    select: { id: true },
  })

  let totalCheckedCount = 0
  let totalAvailableCount = 0
  let totalUnavailableCount = 0
  let totalUnknownCount = 0
  let totalSkippedCount = 0

  for (const user of users) {
    const result = await runUserHealthCheck({
      userId: user.id,
      maxCheckCount: params.maxCheckPerUser,
      triggerType: 'SCHEDULED',
      timeoutMs: params.timeoutMs,
    })

    totalCheckedCount += result.checkedCount
    totalAvailableCount += result.availableCount
    totalUnavailableCount += result.unavailableCount
    totalUnknownCount += result.unknownCount
    totalSkippedCount += result.skippedCount
  }

  return {
    userCount: users.length,
    totalCheckedCount,
    totalAvailableCount,
    totalUnavailableCount,
    totalUnknownCount,
    totalSkippedCount,
  }
}
