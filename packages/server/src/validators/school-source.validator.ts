import { z } from 'zod'

/**
 * @description 院校官方源链接校验。
 */
const schoolSourceUrlSchema = z.string()
  .trim()
  .min(3, '请输入官方链接')
  .max(300, '链接长度不能超过 300 个字符')
  .refine((value) => {
    try {
      const normalizedValue = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value) ? value : `https://${value}`
      const parsed = new URL(normalizedValue)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }, '请输入合法链接')

/**
 * @description 院校官方源列表查询参数校验。
 */
export const schoolSourceListQuerySchema = z.object({
  keyword: z.string().trim().max(80, '关键词最多 80 个字符').optional(),
  schoolName: z.string().trim().max(80, '学校名称最多 80 个字符').optional(),
  isActive: z.enum(['true', 'false']).optional(),
})

/**
 * @description 新增院校官方源参数校验。
 */
export const schoolSourceCreateSchema = z.object({
  schoolName: z.string().trim().min(2, '学校名称至少 2 个字符').max(80, '学校名称最多 80 个字符'),
  siteName: z.string().trim().min(2, '站点名称至少 2 个字符').max(80, '站点名称最多 80 个字符'),
  baseUrl: schoolSourceUrlSchema,
  description: z.string().trim().max(300, '描述最多 300 个字符').optional(),
  priority: z.coerce.number().int('优先级必须为整数').min(0, '优先级不能小于 0').max(9999, '优先级不能大于 9999').optional(),
  isActive: z.boolean().optional(),
})

/**
 * @description 更新院校官方源参数校验。
 */
export const schoolSourceUpdateSchema = z.object({
  schoolName: z.string().trim().min(2, '学校名称至少 2 个字符').max(80, '学校名称最多 80 个字符').optional(),
  siteName: z.string().trim().min(2, '站点名称至少 2 个字符').max(80, '站点名称最多 80 个字符').optional(),
  baseUrl: schoolSourceUrlSchema.optional(),
  description: z.string().trim().max(300, '描述最多 300 个字符').nullable().optional(),
  priority: z.coerce.number().int('优先级必须为整数').min(0, '优先级不能小于 0').max(9999, '优先级不能大于 9999').optional(),
  isActive: z.boolean().optional(),
})

/**
 * @description 院校官方源路径参数校验。
 */
export const schoolSourceIdParamSchema = z.object({
  id: z.string().trim().min(1, 'ID 不能为空'),
})
