import { Router } from 'express'
import { ProfessorController } from '../controllers/professor.controller.js'
import { authMiddleware } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { createProfessorSchema, updateProfessorSchema, updateStatusSchema } from '../validators/professor.validator.js'

const router: Router = Router()
const controller = new ProfessorController()

router.use(authMiddleware)

/** @description GET /api/professors - 获取导师列表 */
router.get('/', (req, res, next) => controller.list(req, res, next))

/** @description GET /api/professors/:id - 获取导师详情 */
router.get('/:id', (req, res, next) => controller.detail(req, res, next))

/** @description POST /api/professors - 创建导师 */
router.post('/', validate(createProfessorSchema), (req, res, next) =>
  controller.create(req, res, next)
)

/** @description PUT /api/professors/:id - 更新导师 */
router.put('/:id', validate(updateProfessorSchema), (req, res, next) =>
  controller.update(req, res, next)
)

/** @description DELETE /api/professors/:id - 删除导师 */
router.delete('/:id', (req, res, next) => controller.remove(req, res, next))

/** @description PATCH /api/professors/:id/status - 更新联系状态 */
router.patch('/:id/status', validate(updateStatusSchema), (req, res, next) =>
  controller.updateStatus(req, res, next)
)

export { router as professorRoutes }
