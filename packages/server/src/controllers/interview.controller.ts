import { NextFunction, Request, Response } from 'express'
import { prisma } from '../config/database.js'
import { errorResponse, successResponse } from '../utils/response.js'

interface CreateInterviewBody {
  professorId: string
  scheduledAt: string | Date
  duration?: number
  method?: string
  location?: string
  meetingLink?: string
  preparationNotes?: string
}

interface UpdateInterviewBody {
  professorId?: string
  scheduledAt?: string | Date
  duration?: number
  method?: string
  location?: string
  meetingLink?: string
  preparationNotes?: string
  status?: string
}

interface UpdateInterviewStatusBody {
  status: string
}

export class InterviewController {
  /** @description GET /api/interviews - 面试列表 */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }

      const userId = req.user.id
      const professorId = typeof req.query.professorId === 'string' ? req.query.professorId : undefined
      const status = typeof req.query.status === 'string' ? req.query.status : undefined

      const professors = await prisma.professor.findMany({
        where: { userId },
        select: { id: true },
      })
      const professorIds = professors.map((item) => item.id)

      if (professorIds.length === 0) {
        return successResponse(res, [])
      }

      if (professorId && !professorIds.includes(professorId)) {
        return successResponse(res, [])
      }

      const where: { professorId: string | { in: string[] }; status?: string } = {
        professorId: professorId ?? { in: professorIds },
      }

      if (status) {
        where.status = status
      }

      const interviews = await prisma.interview.findMany({
        where,
        include: {
          professor: true,
          logs: {
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { scheduledAt: 'desc' },
      })

      return successResponse(res, interviews)
    } catch (err) {
      return next(err)
    }
  }

  /** @description GET /api/interviews/:id - 面试详情 */
  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }

      const userId = req.user.id
      const id = String(req.params.id)

      const interview = await prisma.interview.findFirst({
        where: { id },
        include: {
          professor: true,
          logs: {
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      if (!interview || interview.professor.userId !== userId) {
        return errorResponse(res, '面试不存在', 404)
      }

      return successResponse(res, interview)
    } catch (err) {
      return next(err)
    }
  }

  /** @description POST /api/interviews - 创建面试 */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }

      const userId = req.user.id
      const payload = req.body as CreateInterviewBody

      const professor = await prisma.professor.findFirst({
        where: { id: payload.professorId, userId },
      })

      if (!professor) {
        return errorResponse(res, '导师不存在', 404)
      }

      const scheduledAt = new Date(payload.scheduledAt)
      if (Number.isNaN(scheduledAt.getTime())) {
        return errorResponse(res, 'scheduledAt 格式无效', 400)
      }

      const interview = await prisma.interview.create({
        data: {
          professorId: payload.professorId,
          scheduledAt,
          duration: payload.duration,
          method: payload.method,
          location: payload.location,
          meetingLink: payload.meetingLink,
          preparationNotes: payload.preparationNotes,
        },
        include: {
          professor: true,
          logs: true,
        },
      })

      return successResponse(res, interview, '创建成功')
    } catch (err) {
      return next(err)
    }
  }

  /** @description PUT /api/interviews/:id - 更新面试 */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }

      const userId = req.user.id
      const id = String(req.params.id)
      const payload = req.body as UpdateInterviewBody

      const exists = await prisma.interview.findFirst({
        where: { id },
        include: {
          professor: {
            select: { userId: true },
          },
        },
      })

      if (!exists || exists.professor.userId !== userId) {
        return errorResponse(res, '面试不存在', 404)
      }

      const updateData: {
        professorId?: string
        scheduledAt?: Date
        duration?: number
        method?: string
        location?: string | null
        meetingLink?: string | null
        preparationNotes?: string | null
        status?: string
      } = {}

      if (payload.professorId !== undefined) {
        const professor = await prisma.professor.findFirst({
          where: { id: payload.professorId, userId },
        })
        if (!professor) {
          return errorResponse(res, '导师不存在', 404)
        }
        updateData.professorId = payload.professorId
      }

      if (payload.scheduledAt !== undefined) {
        const scheduledAt = new Date(payload.scheduledAt)
        if (Number.isNaN(scheduledAt.getTime())) {
          return errorResponse(res, 'scheduledAt 格式无效', 400)
        }
        updateData.scheduledAt = scheduledAt
      }

      if (payload.duration !== undefined) {
        updateData.duration = payload.duration
      }

      if (payload.method !== undefined) {
        updateData.method = payload.method
      }

      if (payload.location !== undefined) {
        updateData.location = payload.location
      }

      if (payload.meetingLink !== undefined) {
        updateData.meetingLink = payload.meetingLink
      }

      if (payload.preparationNotes !== undefined) {
        updateData.preparationNotes = payload.preparationNotes
      }

      if (payload.status !== undefined) {
        updateData.status = payload.status
      }

      const interview = await prisma.interview.update({
        where: { id },
        data: updateData,
        include: {
          professor: true,
          logs: {
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      return successResponse(res, interview, '更新成功')
    } catch (err) {
      return next(err)
    }
  }

  /** @description DELETE /api/interviews/:id - 删除面试 */
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }

      const userId = req.user.id
      const id = String(req.params.id)

      const exists = await prisma.interview.findFirst({
        where: { id },
        include: {
          professor: {
            select: { userId: true },
          },
        },
      })

      if (!exists || exists.professor.userId !== userId) {
        return errorResponse(res, '面试不存在', 404)
      }

      await prisma.interview.delete({
        where: { id },
      })

      return successResponse(res, null, '删除成功')
    } catch (err) {
      return next(err)
    }
  }

  /** @description PATCH /api/interviews/:id/status - 更新面试状态 */
  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }

      const userId = req.user.id
      const id = String(req.params.id)
      const payload = req.body as UpdateInterviewStatusBody

      if (!payload.status) {
        return errorResponse(res, 'status 不能为空', 400)
      }

      const exists = await prisma.interview.findFirst({
        where: { id },
        include: {
          professor: {
            select: { userId: true },
          },
        },
      })

      if (!exists || exists.professor.userId !== userId) {
        return errorResponse(res, '面试不存在', 404)
      }

      const interview = await prisma.interview.update({
        where: { id },
        data: { status: payload.status },
        include: {
          professor: true,
          logs: {
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      return successResponse(res, interview, '状态更新成功')
    } catch (err) {
      return next(err)
    }
  }
}
