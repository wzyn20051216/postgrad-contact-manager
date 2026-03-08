import { NextFunction, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { error, success } from '../utils/response.js'

type AuthUser = NonNullable<Request['user']> & {
  userId?: string
}

export class StatsController {
  /** @description GET /api/stats/overview - 获取统计概览 */
  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user as AuthUser | undefined
      const userId = user?.userId ?? user?.id

      if (!userId) {
        return error(res, '未登录', 401)
      }

      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const [professorCount, statusGroupBy, interviewCount, thisMonthAdded] = await Promise.all([
        prisma.professor.count({
          where: { userId },
        }),
        prisma.professor.groupBy({
          by: ['contactStatus'],
          where: { userId },
          _count: {
            _all: true,
          },
        }),
        prisma.interview.count({
          where: {
            professor: {
              userId,
            },
          },
        }),
        prisma.professor.count({
          where: {
            userId,
            createdAt: {
              gte: monthStart,
            },
          },
        }),
      ])

      const statusDistribution: Array<{ status: string; count: number }> = statusGroupBy.map((item) => ({
        status: item.contactStatus,
        count: item._count._all,
      }))

      return success(res, {
        professorCount,
        interviewCount,
        thisMonthAdded,
        statusDistribution,
      })
    } catch (err) {
      return next(err)
    }
  }
}

export const statsController = new StatsController()
