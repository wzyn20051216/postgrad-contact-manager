import { NextFunction, Request, Response } from 'express'
import { prisma } from '../config/database.js'
import { errorResponse, successResponse } from '../utils/response.js'

interface NoteBody {
  title?: string
  content?: string
  professorId?: string | null
}

export class NoteController {
  /** @description Get notes of current user */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)
      const { professorId } = req.query
      const notes = await prisma.note.findMany({
        where: {
          userId: req.user.id,
          ...(professorId ? { professorId: String(professorId) } : {}),
        },
        include: {
          professor: { select: { id: true, name: true, university: true } },
        },
        orderBy: { updatedAt: 'desc' },
      })
      return successResponse(res, notes)
    } catch (err) {
      return next(err)
    }
  }

  /** @description Get note detail by id */
  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)
      const note = await prisma.note.findFirst({
        where: { id: String(req.params.id), userId: req.user.id },
        include: {
          professor: { select: { id: true, name: true, university: true } },
        },
      })
      if (!note) return errorResponse(res, 'Note not found', 404)
      return successResponse(res, note)
    } catch (err) {
      return next(err)
    }
  }

  /** @description Create note */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)
      const body = req.body as NoteBody
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      const content = typeof body.content === 'string' ? body.content.trim() : ''
      if (!title) return errorResponse(res, 'title is required', 400)
      if (!content) return errorResponse(res, 'content is required', 400)

      const professorId = body.professorId ? String(body.professorId) : undefined
      if (professorId) {
        const owned = await this.isProfessorOwnedByUser(req.user.id, professorId)
        if (!owned) return errorResponse(res, 'Professor not found or no permission', 404)
      }

      const note = await prisma.note.create({
        data: {
          userId: req.user.id,
          title,
          content,
          ...(professorId ? { professorId } : {}),
        },
        include: {
          professor: { select: { id: true, name: true, university: true } },
        },
      })
      return successResponse(res, note, 'Created')
    } catch (err) {
      return next(err)
    }
  }

  /** @description Update note */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)
      const id = String(req.params.id)
      const exists = await prisma.note.findFirst({
        where: { id, userId: req.user.id },
        select: { id: true },
      })
      if (!exists) return errorResponse(res, 'Note not found', 404)

      const body = req.body as NoteBody
      const data: Record<string, string | null> = {}
      if (body.title !== undefined) data.title = String(body.title).trim()
      if (body.content !== undefined) data.content = String(body.content).trim()
      if (body.professorId !== undefined) {
        const professorId = body.professorId ? String(body.professorId) : null
        if (professorId) {
          const owned = await this.isProfessorOwnedByUser(req.user.id, professorId)
          if (!owned) return errorResponse(res, 'Professor not found or no permission', 404)
        }
        data.professorId = professorId
      }

      const note = await prisma.note.update({
        where: { id },
        data,
        include: {
          professor: { select: { id: true, name: true, university: true } },
        },
      })
      return successResponse(res, note, 'Updated')
    } catch (err) {
      return next(err)
    }
  }

  /** @description Delete note */
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)
      const id = String(req.params.id)
      const exists = await prisma.note.findFirst({
        where: { id, userId: req.user.id },
        select: { id: true },
      })
      if (!exists) return errorResponse(res, 'Note not found', 404)
      await prisma.note.delete({ where: { id } })
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
