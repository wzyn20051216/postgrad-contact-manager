import { Router } from 'express'
import { TagController } from '../controllers/tag.controller.js'
import { authMiddleware } from '../middlewares/auth.js'

const router: Router = Router()
const controller = new TagController()

router.use(authMiddleware)

/** @description GET /api/tags - 获取标签列表 */
router.get('/', (req, res, next) => controller.list(req, res, next))

/** @description POST /api/tags - 创建标签 */
router.post('/', (req, res, next) => controller.create(req, res, next))

/** @description PUT /api/tags/:id - 更新标签 */
router.put('/:id', (req, res, next) => controller.update(req, res, next))

/** @description DELETE /api/tags/:id - 删除标签 */
router.delete('/:id', (req, res, next) => controller.remove(req, res, next))

export { router as tagRoutes }
