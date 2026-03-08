import { Router } from 'express'
import { statsController } from '../controllers/stats.controller.js'
import { authMiddleware } from '../middlewares/auth.middleware.js'

const router: Router = Router()

/** @description GET /api/stats/overview - 获取统计概览 */
router.get('/overview', authMiddleware, (req, res, next) =>
  statsController.getOverview(req, res, next)
)

export { router as statsRoutes }
