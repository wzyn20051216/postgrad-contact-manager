import { z } from 'zod'

/**
 * @description 高校信息检索参数校验
 */
export const schoolSearchQuerySchema = z.object({
  schoolName: z
    .string()
    .trim()
    .min(2, '学校名称至少2个字符')
    .max(80, '学校名称最多80个字符'),
  focus: z
    .string()
    .trim()
    .max(80, '关注关键词最多80个字符')
    .optional(),
  maxSources: z
    .coerce
    .number()
    .int('来源数量必须为整数')
    .min(1, '来源数量最少1个')
    .max(8, '来源数量最多8个')
    .optional(),
})

