import { Request, Response, NextFunction } from 'express'
import { ProfessorService } from '../services/professor.service.js'
import { success, error, paginate } from '../utils/response.js'

const professorService = new ProfessorService()

export class ProfessorController {
  /** @description 获取导师列表（分页） */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id
      const page = Number.parseInt((req.query.page as string) ?? '', 10) || 1
      const pageSize = Number.parseInt((req.query.pageSize as string) ?? '', 10) || 20
      const search = typeof req.query.search === 'string' ? req.query.search : undefined
      const status = typeof req.query.status === 'string' ? req.query.status : undefined

      const { data, total } = await professorService.list(userId, {
        page,
        pageSize,
        search,
        status,
      })

      return paginate(res, data, total, page, pageSize)
    } catch (err) {
      return next(err)
    }
  }

  /** @description 获取导师详情 */
  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id
      const id = String(req.params.id)
      const professor = await professorService.detail(id, userId)

      if (!professor) {
        return error(res, '导师不存在', 404)
      }

      return success(res, professor)
    } catch (err) {
      return next(err)
    }
  }

  /** @description 创建导师 */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id
      const payload = req.body
      const professor = await professorService.create(userId, payload)
      return success(res, professor, '创建成功')
    } catch (err) {
      return next(err)
    }
  }

  /** @description 更新导师 */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id
      const id = String(req.params.id)
      const payload = req.body
      const professor = await professorService.update(id, userId, payload)
      return success(res, professor, '更新成功')
    } catch (err) {
      return next(err)
    }
  }

  /** @description 删除导师 */
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id
      const id = String(req.params.id)
      await professorService.remove(id, userId)
      return success(res, null, '删除成功')
    } catch (err) {
      return next(err)
    }
  }

  /** @description 更新联系状态 */
  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id
      const id = String(req.params.id)
      const { status, remark } = req.body as { status: string; remark?: string }
      const professor = await professorService.updateStatus(id, userId, status, remark)
      return success(res, professor, '状态更新成功')
    } catch (err) {
      return next(err)
    }
  }
}
