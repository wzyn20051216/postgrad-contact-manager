import { NextFunction, Request, Response } from 'express'
import { prisma } from '../config/database.js'
import { errorResponse, successResponse } from '../utils/response.js'

interface CreateTagBody {
  name?: string
  color?: string
}

interface UpdateTagBody {
  name?: string
  color?: string
}

export class TagController {
  /** @description GET /api/tags - 获取当前用户标签列表（含关联导师数量） */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }

      const userId = req.user.id
      const tags = await prisma.tag.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          color: true,
          _count: {
            select: {
              professors: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      })

      return successResponse(res, tags)
    } catch (err) {
      return next(err)
    }
  }

  /** @description POST /api/tags - 创建标签 */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }

      const userId = req.user.id
      const payload = req.body as CreateTagBody
      const name = typeof payload.name === 'string' ? payload.name.trim() : ''
      const color = typeof payload.color === 'string' ? payload.color.trim() : undefined

      if (!name) {
        return errorResponse(res, 'name 不能为空', 400)
      }

      const tag = await prisma.tag.create({
        data: {
          userId,
          name,
          ...(color ? { color } : {}),
        },
      })

      return successResponse(res, tag, '创建成功')
    } catch (err) {
      return next(err)
    }
  }

  /** @description PUT /api/tags/:id - 更新标签 */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }

      const userId = req.user.id
      const id = String(req.params.id)
      const payload = req.body as UpdateTagBody

      const updateData: { name?: string; color?: string } = {}

      if (payload.name !== undefined) {
        if (typeof payload.name !== 'string' || !payload.name.trim()) {
          return errorResponse(res, 'name 不能为空', 400)
        }
        updateData.name = payload.name.trim()
      }

      if (payload.color !== undefined) {
        if (typeof payload.color !== 'string' || !payload.color.trim()) {
          return errorResponse(res, 'color 不能为空', 400)
        }
        updateData.color = payload.color.trim()
      }

      if (Object.keys(updateData).length === 0) {
        return errorResponse(res, '至少提供一个可更新字段', 400)
      }

      const exists = await prisma.tag.findFirst({
        where: { id, userId },
        select: { id: true },
      })

      if (!exists) {
        return errorResponse(res, '标签不存在', 404)
      }

      const tag = await prisma.tag.update({
        where: { id },
        data: updateData,
      })

      return successResponse(res, tag, '更新成功')
    } catch (err) {
      return next(err)
    }
  }

  /** @description DELETE /api/tags/:id - 解除关联后删除标签 */
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, '未登录', 401)
      }

      const userId = req.user.id
      const id = String(req.params.id)

      const exists = await prisma.tag.findFirst({
        where: { id, userId },
        select: { id: true },
      })

      if (!exists) {
        return errorResponse(res, '标签不存在', 404)
      }

      await prisma.$transaction([
        prisma.tagOnProfessor.deleteMany({
          where: { tagId: id },
        }),
        prisma.tag.delete({
          where: { id },
        }),
      ])

      return successResponse(res, null, '删除成功')
    } catch (err) {
      return next(err)
    }
  }
}
