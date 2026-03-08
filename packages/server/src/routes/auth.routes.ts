import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { AuthController } from '../controllers/auth.controller.js'
import { authMiddleware } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  sendRegisterCodeSchema,
  sendResetPasswordCodeSchema,
} from '../validators/auth.validator.js'

const router: Router = Router()
const controller = new AuthController()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many attempts, please try again later' },
})

const registerCodeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 6,
  message: { success: false, message: '验证码请求过于频繁，请稍后再试' },
})

const resetPasswordCodeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 6,
  message: { success: false, message: '验证码请求过于频繁，请稍后再试' },
})

/** POST /api/auth/register-code - 发送注册验证码 */
router.post('/register-code', registerCodeLimiter, validate(sendRegisterCodeSchema), (req, res, next) =>
  controller.sendRegisterCode(req, res, next)
)

/** POST /api/auth/reset-password-code - 发送重置密码验证码 */
router.post('/reset-password-code', resetPasswordCodeLimiter, validate(sendResetPasswordCodeSchema), (req, res, next) =>
  controller.sendResetPasswordCode(req, res, next)
)

/** POST /api/auth/register - 用户注册 */
router.post('/register', authLimiter, validate(registerSchema), (req, res, next) =>
  controller.register(req, res, next)
)

/** POST /api/auth/reset-password - 使用邮箱验证码重置密码 */
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), (req, res, next) =>
  controller.resetPassword(req, res, next)
)

/** POST /api/auth/login - 用户登录 */
router.post('/login', authLimiter, validate(loginSchema), (req, res, next) =>
  controller.login(req, res, next)
)

/** GET /api/auth/github/authorize - GitHub OAuth 授权入口 */
router.get('/github/authorize', (req, res, next) =>
  controller.githubAuthorize(req, res, next)
)

/** GET /api/auth/github/callback - GitHub OAuth 回调 */
router.get('/github/callback', (req, res, next) =>
  controller.githubCallback(req, res, next)
)

/** GET /api/auth/me - 获取当前用户信息 */
router.get('/me', authMiddleware, (req, res, next) =>
  controller.me(req, res, next)
)

/** PUT /api/auth/profile - 更新用户资料 */
router.put('/profile', authMiddleware, (req, res, next) =>
  controller.updateProfile(req, res, next)
)

/** PUT /api/auth/password - 修改密码 */
router.put('/password', authMiddleware, (req, res, next) =>
  controller.updatePassword(req, res, next)
)

/** DELETE /api/auth/account - 注销账号 */
router.delete('/account', authMiddleware, (req, res, next) =>
  controller.deleteAccount(req, res, next)
)

/** POST /api/auth/logout - 退出登录 */
router.post('/logout', authMiddleware, (req, res) =>
  controller.logout(req, res)
)

export { router as authRoutes }
