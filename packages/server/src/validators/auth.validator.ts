import { z } from 'zod'

/** 发送注册验证码参数校验 */
export const sendRegisterCodeSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
})

/** 注册参数校验 */
export const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少6个字符').max(50, '密码最多50个字符'),
  nickname: z.string().min(1).max(50).optional(),
  verificationCode: z.string().regex(/^\d{6}$/, '请输入 6 位数字验证码'),
})

/** 发送重置密码验证码参数校验 */
export const sendResetPasswordCodeSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
})

/** 重置密码参数校验 */
export const resetPasswordSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  verificationCode: z.string().regex(/^\d{6}$/, '请输入 6 位数字验证码'),
  newPassword: z.string().min(6, '新密码至少6个字符').max(50, '新密码最多50个字符'),
})

/** 登录参数校验 */
export const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
})
