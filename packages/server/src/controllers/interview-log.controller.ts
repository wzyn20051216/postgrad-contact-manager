import { NextFunction, Request, Response } from 'express'
import { prisma } from '../config/database.js'
import { errorResponse, successResponse } from '../utils/response.js'

interface CreateInterviewLogBody {
  content: string
  selfRating?: number
  mood?: string
  questionsAsked?: string
  keyTakeaways?: string
}

interface UpdateInterviewLogBody {
  content?: string
  selfRating?: number
  mood?: string
  questionsAsked?: string
  keyTakeaways?: string
}

export class InterviewLogController {
  /** @description GET /api/interviews/:interviewId/logs - 面试日志列表 */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }

      const userId = req.user.id
      const interviewId = String(req.params.interviewId)

      const interview = await prisma.interview.findFirst({
        where: { id: interviewId },
        include: {
          professor: {
            select: { userId: true },
          },
        },
      })

      if (!interview || interview.professor.userId !== userId) {
        return errorResponse(res, '面试不存在', 404)
      }

      const logs = await prisma.interviewLog.findMany({
        where: { interviewId },
        orderBy: { createdAt: 'desc' },
      })

      return successResponse(res, logs)
    } catch (err) {
      return next(err)
    }
  }

  /** @description POST /api/interviews/:interviewId/logs - 创建面试日志 */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }

      const userId = req.user.id
      const interviewId = String(req.params.interviewId)
      const payload = req.body as CreateInterviewLogBody

      if (!payload.content) {
        return errorResponse(res, 'content 不能为空', 400)
      }

      const interview = await prisma.interview.findFirst({
        where: { id: interviewId },
        include: {
          professor: {
            select: { userId: true },
          },
        },
      })

      if (!interview || interview.professor.userId !== userId) {
        return errorResponse(res, '面试不存在', 404)
      }

      const log = await prisma.interviewLog.create({
        data: {
          interviewId,
          content: payload.content,
          selfRating: payload.selfRating,
          mood: payload.mood,
          questionsAsked: payload.questionsAsked,
          keyTakeaways: payload.keyTakeaways,
        },
      })

      return successResponse(res, log, '创建成功')
    } catch (err) {
      return next(err)
    }
  }

  /** @description PUT /api/interviews/:interviewId/logs/:id - 更新面试日志 */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }

      const userId = req.user.id
      const interviewId = String(req.params.interviewId)
      const id = String(req.params.id)
      const payload = req.body as UpdateInterviewLogBody

      const interview = await prisma.interview.findFirst({
        where: { id: interviewId },
        include: {
          professor: {
            select: { userId: true },
          },
        },
      })

      if (!interview || interview.professor.userId !== userId) {
        return errorResponse(res, '面试不存在', 404)
      }

      const exists = await prisma.interviewLog.findFirst({
        where: { id, interviewId },
      })

      if (!exists) {
        return errorResponse(res, '面试日志不存在', 404)
      }

      const data: {
        content?: string
        selfRating?: number | null
        mood?: string | null
        questionsAsked?: string | null
        keyTakeaways?: string | null
      } = {}

      if (payload.content !== undefined) {
        data.content = payload.content
      }

      if (payload.selfRating !== undefined) {
        data.selfRating = payload.selfRating
      }

      if (payload.mood !== undefined) {
        data.mood = payload.mood
      }

      if (payload.questionsAsked !== undefined) {
        data.questionsAsked = payload.questionsAsked
      }

      if (payload.keyTakeaways !== undefined) {
        data.keyTakeaways = payload.keyTakeaways
      }

      const log = await prisma.interviewLog.update({
        where: { id },
        data,
      })

      return successResponse(res, log, '更新成功')
    } catch (err) {
      return next(err)
    }
  }

  /** @description DELETE /api/interviews/:interviewId/logs/:id - 删除面试日志 */
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }

      const userId = req.user.id
      const interviewId = String(req.params.interviewId)
      const id = String(req.params.id)

      const interview = await prisma.interview.findFirst({
        where: { id: interviewId },
        include: {
          professor: {
            select: { userId: true },
          },
        },
      })

      if (!interview || interview.professor.userId !== userId) {
        return errorResponse(res, '面试不存在', 404)
      }

      const exists = await prisma.interviewLog.findFirst({
        where: { id, interviewId },
      })

      if (!exists) {
        return errorResponse(res, '面试日志不存在', 404)
      }

      await prisma.interviewLog.delete({
        where: { id },
      })

      return successResponse(res, null, '删除成功')
    } catch (err) {
      return next(err)
    }
  }
}
