import nodemailer, { type Transporter } from 'nodemailer'
import { config } from '../config/index.js'
import { AppError } from '../middlewares/errorHandler.js'

export interface MailSendResult {
  deliveryMode: 'smtp' | 'debug'
  previewCode?: string
}

interface VerificationMailOptions {
  email: string
  verificationCode: string
  expiresMinutes: number
  subject: string
  title: string
  description: string
  debugScene: '注册' | '重置密码'
}

let transporter: Transporter | null = null

/**
 * @description 获取 SMTP 发送器实例。
 * @returns 发送器实例
 */
function getTransporter(): Transporter {
  if (transporter) {
    return transporter
  }

  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: config.smtpUser
      ? {
          user: config.smtpUser,
          pass: config.smtpPass,
        }
      : undefined,
  })

  return transporter
}

/**
 * @description 构建发件人显示名称。
 * @returns 发件人字符串
 */
function getFromAddress(): string {
  return config.smtpFromName
    ? `"${config.smtpFromName}" <${config.smtpFrom}>`
    : config.smtpFrom
}

export class MailService {
  /**
   * @description 发送注册验证码邮件。
   * @param email 收件邮箱
   * @param verificationCode 验证码
   * @param expiresMinutes 过期分钟数
   * @returns 发送结果
   */
  async sendRegisterVerificationCode(
    email: string,
    verificationCode: string,
    expiresMinutes: number
  ): Promise<MailSendResult> {
    return this.sendVerificationCodeMail({
      email,
      verificationCode,
      expiresMinutes,
      subject: '套磁管理系统注册验证码',
      title: '欢迎注册套磁管理系统',
      description: '你正在进行邮箱注册，本次验证码如下：',
      debugScene: '注册',
    })
  }

  /**
   * @description 发送重置密码验证码邮件。
   * @param email 收件邮箱
   * @param verificationCode 验证码
   * @param expiresMinutes 过期分钟数
   * @returns 发送结果
   */
  async sendPasswordResetVerificationCode(
    email: string,
    verificationCode: string,
    expiresMinutes: number
  ): Promise<MailSendResult> {
    return this.sendVerificationCodeMail({
      email,
      verificationCode,
      expiresMinutes,
      subject: '套磁管理系统重置密码验证码',
      title: '正在重置你的登录密码',
      description: '你正在执行找回密码操作，本次验证码如下：',
      debugScene: '重置密码',
    })
  }

  /**
   * @description 发送统一验证码邮件。
   * @param options 邮件配置
   * @returns 发送结果
   */
  private async sendVerificationCodeMail(options: VerificationMailOptions): Promise<MailSendResult> {
    const {
      email,
      verificationCode,
      expiresMinutes,
      subject,
      title,
      description,
      debugScene,
    } = options

    if (!config.smtpEnabled) {
      if (process.env.NODE_ENV !== 'production') {
        console.info(`[Auth][Debug] ${email} 的${debugScene}验证码为：${verificationCode}`)
        return {
          deliveryMode: 'debug',
          previewCode: verificationCode,
        }
      }

      throw new AppError('邮箱服务尚未配置，请先补充 SMTP 环境变量', 500)
    }

    const html = `
      <div style="font-family: 'Segoe UI', 'PingFang SC', sans-serif; color: #0f172a; line-height: 1.7;">
        <h2 style="margin: 0 0 12px;">${title}</h2>
        <p style="margin: 0 0 14px;">${description}</p>
        <div style="display: inline-block; padding: 12px 18px; border-radius: 12px; background: #eff6ff; border: 1px solid #bfdbfe; font-size: 24px; font-weight: 700; letter-spacing: 0.28em; color: #2563eb;">
          ${verificationCode}
        </div>
        <p style="margin: 14px 0 0; color: #475569;">验证码 ${expiresMinutes} 分钟内有效，请勿泄露给他人。</p>
      </div>
    `

    await getTransporter().sendMail({
      from: getFromAddress(),
      to: email,
      subject,
      html,
      text: `${subject}：${verificationCode}，${expiresMinutes} 分钟内有效。`,
    })

    return {
      deliveryMode: 'smtp',
    }
  }
}

export const mailService = new MailService()
