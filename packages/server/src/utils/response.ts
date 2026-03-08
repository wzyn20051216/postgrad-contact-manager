import { Response } from 'express'

/** @description 成功响应 */
export function success(res: Response, data: any = null, message: string = '操作成功') {
  return res.json({
    success: true,
    message,
    data,
  })
}

/** @description 错误响应 */
export function error(res: Response, message: string = '操作失败', statusCode: number = 400) {
  return res.status(statusCode).json({
    success: false,
    message,
  })
}

/** @description 成功响应别名 */
export const successResponse = success

/** @description 错误响应别名 */
export const errorResponse = error

/** @description 分页响应 */
export function paginate(res: Response, list: any[], total: number, page: number, pageSize: number) {
  return res.json({
    success: true,
    data: {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  })
}
