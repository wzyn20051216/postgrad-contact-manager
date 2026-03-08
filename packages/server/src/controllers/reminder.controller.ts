import { NextFunction, Request, Response } from 'express'
import { prisma } from '../config/database.js'
import { errorResponse, successResponse } from '../utils/response.js'

interface ReminderBody {
  title?: string
  description?: string
  remindAt?: string
  type?: string
  professorId?: string | null
}

export class ReminderController {
  /** @description Get reminders of current user */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)
      const { completed } = req.query
      const reminders = await prisma.reminder.findMany({
        where: {
          userId: req.user.id,
          ...(completed !== undefined ? { isCompleted: completed === 'true' } : {}),
        },
        include: {
          professor: { select: { id: true, name: true, university: true } },
        },
        orderBy: { remindAt: 'asc' },
      })
      return successResponse(res, reminders)
    } catch (err) {
      return next(err)
    }
  }

  /** @description Get reminder detail by id */
  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)
      const reminder = await prisma.reminder.findFirst({
        where: { id: String(req.params.id), userId: req.user.id },
        include: {
          professor: { select: { id: true, name: true, university: true } },
        },
      })
      if (!reminder) return errorResponse(res, 'Reminder not found', 404)
      return successResponse(res, reminder)
    } catch (err) {
      return next(err)
    }
  }

  /** @description Create reminder */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)
      const body = req.body as ReminderBody
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      if (!title) return errorResponse(res, 'title is required', 400)
      if (!body.remindAt) return errorResponse(res, 'remindAt is required', 400)

      const remindAt = new Date(body.remindAt)
      if (Number.isNaN(remindAt.getTime())) return errorResponse(res, 'invalid remindAt', 400)

      const professorId = body.professorId ? String(body.professorId) : undefined
      if (professorId) {
        const owned = await this.isProfessorOwnedByUser(req.user.id, professorId)
        if (!owned) return errorResponse(res, 'Professor not found or no permission', 404)
      }

      const reminder = await prisma.reminder.create({
        data: {
          userId: req.user.id,
          title,
          description: typeof body.description === 'string' ? body.description.trim() : undefined,
          remindAt,
          type: typeof body.type === 'string' ? body.type : 'FOLLOW_UP',
          ...(professorId ? { professorId } : {}),
        },
        include: {
          professor: { select: { id: true, name: true, university: true } },
        },
      })
      return successResponse(res, reminder, 'Created')
    } catch (err) {
      return next(err)
    }
  }

  /** @description Update reminder */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)
      const id = String(req.params.id)
      const exists = await prisma.reminder.findFirst({
        where: { id, userId: req.user.id },
        select: { id: true },
      })
      if (!exists) return errorResponse(res, 'Reminder not found', 404)

      const body = req.body as ReminderBody
      const data: Record<string, string | Date | null> = {}
      if (body.title !== undefined) data.title = String(body.title).trim()
      if (body.description !== undefined) data.description = String(body.description).trim()
      if (body.type !== undefined) data.type = String(body.type)
      if (body.professorId !== undefined) {
        const professorId = body.professorId ? String(body.professorId) : null
        if (professorId) {
          const owned = await this.isProfessorOwnedByUser(req.user.id, professorId)
          if (!owned) return errorResponse(res, 'Professor not found or no permission', 404)
        }
        data.professorId = professorId
      }
      if (body.remindAt !== undefined) {
        const dt = new Date(body.remindAt)
        if (Number.isNaN(dt.getTime())) return errorResponse(res, 'invalid remindAt', 400)
        data.remindAt = dt
      }

      const reminder = await prisma.reminder.update({
        where: { id },
        data,
        include: {
          professor: { select: { id: true, name: true, university: true } },
        },
      })
      return successResponse(res, reminder, 'Updated')
    } catch (err) {
      return next(err)
    }
  }

  /** @description Mark reminder as completed */
  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)
      const id = String(req.params.id)
      const exists = await prisma.reminder.findFirst({
        where: { id, userId: req.user.id },
        select: { id: true },
      })
      if (!exists) return errorResponse(res, 'Reminder not found', 404)
      const reminder = await prisma.reminder.update({
        where: { id },
        data: { isCompleted: true },
      })
      return successResponse(res, reminder, 'Completed')
    } catch (err) {
      return next(err)
    }
  }

  /** @description Delete reminder */
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)
      const id = String(req.params.id)
      const exists = await prisma.reminder.findFirst({
        where: { id, userId: req.user.id },
        select: { id: true },
      })
      if (!exists) return errorResponse(res, 'Reminder not found', 404)
      await prisma.reminder.delete({ where: { id } })
      return successResponse(res, null, 'Deleted')
    } catch (err) {
      return next(err)
    }
  }

  /** @description Validate professor ownership for current user */
  private async isProfessorOwnedByUser(userId: string, professorId: string): Promise<boolean> {
    const professor = await prisma.professor.findFirst({
      where: { id: professorId, userId },
      select: { id: true },
    })

    return Boolean(professor)
  }
}
