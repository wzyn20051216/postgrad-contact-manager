import { Router } from 'express'
import { DataController } from '../controllers/data.controller.js'
import { authMiddleware } from '../middlewares/auth.js'

const router: Router = Router()
const controller = new DataController()

router.use(authMiddleware)

/** @description GET /api/data/export - 导出数据 */
router.get('/export', (req, res, next) => controller.exportData(req, res, next))

/** @description POST /api/data/import - 导入数据 */
router.post('/import', (req, res, next) => controller.importData(req, res, next))

/** @description DELETE /api/data/clear - 清空数据 */
router.delete('/clear', (req, res, next) => controller.clearData(req, res, next))

export { router as dataRoutes }
