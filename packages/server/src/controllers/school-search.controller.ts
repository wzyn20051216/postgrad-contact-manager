import { Request, Response, NextFunction } from 'express'
import { success } from '../utils/response.js'
import { schoolSearchService } from '../services/school-search.service.js'

/**
 * @description 高校信息检索控制器
 */
export class SchoolSearchController {
  /**
   * @description 执行高校信息检索
   * @param req 请求对象
   * @param res 响应对象
   * @param next 错误透传
   * @returns 检索结果
   */
  async query(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = req.body as {
        schoolName: string
        focus?: string
        maxSources?: number
      }

      const data = await schoolSearchService.search(
        payload.schoolName,
        payload.focus,
        payload.maxSources
      )

      return success(res, data, '检索成功')
    } catch (error) {
      return next(error)
    }
  }
}

