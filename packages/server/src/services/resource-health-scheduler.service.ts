import { config } from '../config/index.js'
import { runGlobalScheduledHealthCheck } from './resource-health.service.js'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * @description 资源链接失效检测定时任务服务。
 */
class ResourceHealthSchedulerService {
  private startTimer: NodeJS.Timeout | null = null
  private intervalTimer: NodeJS.Timeout | null = null
  private isRunning = false

  /**
   * @description 计算距离下一次执行的延迟时间。
   * @returns 延迟毫秒数
   */
  private getDelayToNextRun(): number {
    const now = new Date()
    const next = new Date(now)
    next.setHours(config.resourceHealthScheduleHour, config.resourceHealthScheduleMinute, 0, 0)

    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1)
    }

    return Math.max(next.getTime() - now.getTime(), 1000)
  }

  /**
   * @description 运行一次巡检任务。
   */
  private async runOnce(): Promise<void> {
    if (this.isRunning) {
      console.log('[资源巡检] 上一次任务未完成，跳过本次执行')
      return
    }

    this.isRunning = true
    const started = Date.now()

    try {
      const result = await runGlobalScheduledHealthCheck({
        maxCheckPerUser: config.resourceHealthMaxCheckPerUser,
        timeoutMs: config.resourceHealthTimeoutMs,
      })

      const costSeconds = ((Date.now() - started) / 1000).toFixed(1)
      console.log(
        `[资源巡检] 完成: 用户 ${result.userCount}, 检测 ${result.totalCheckedCount}, ` +
          `可用 ${result.totalAvailableCount}, 失效 ${result.totalUnavailableCount}, ` +
          `未知 ${result.totalUnknownCount}, 跳过 ${result.totalSkippedCount}, 耗时 ${costSeconds}s`
      )
    } catch (error) {
      console.error('[资源巡检] 执行失败:', error)
    } finally {
      this.isRunning = false
    }
  }

  /**
   * @description 启动每日定时巡检任务。
   */
  start(): void {
    if (!config.resourceHealthSchedulerEnabled) {
      console.log('[资源巡检] 已禁用自动巡检（RESOURCE_HEALTH_SCHEDULER_ENABLED=false）')
      return
    }

    const delay = this.getDelayToNextRun()
    const scheduleTime = `${String(config.resourceHealthScheduleHour).padStart(2, '0')}:${String(
      config.resourceHealthScheduleMinute
    ).padStart(2, '0')}`

    console.log(`[资源巡检] 已启用，每日 ${scheduleTime} 自动执行`)

    this.startTimer = setTimeout(() => {
      void this.runOnce()

      this.intervalTimer = setInterval(() => {
        void this.runOnce()
      }, ONE_DAY_MS)
    }, delay)
  }
}

export const resourceHealthScheduler = new ResourceHealthSchedulerService()
