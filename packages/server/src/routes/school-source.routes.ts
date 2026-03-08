import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { SchoolSourceController } from '../controllers/school-source.controller.js'
import {
  schoolSourceCreateSchema,
  schoolSourceIdParamSchema,
  schoolSourceListQuerySchema,
  schoolSourceUpdateSchema,
} from '../validators/school-source.validator.js'

const router: Router = Router()
const controller = new SchoolSourceController()

router.use(authMiddleware)

/**
 * @description GET /api/school-sources - 获取院校官方源列表
 */
router.get('/', validate(schoolSourceListQuerySchema, 'query'), (req, res, next) =>
  controller.list(req, res, next)
)

/**
 * @description POST /api/school-sources - 新增院校官方源
 */
router.post('/', validate(schoolSourceCreateSchema), (req, res, next) =>
  controller.create(req, res, next)
)

/**
 * @description PUT /api/school-sources/:id - 更新院校官方源
 */
router.put(
  '/:id',
  validate(schoolSourceIdParamSchema, 'params'),
  validate(schoolSourceUpdateSchema),
  (req, res, next) => controller.update(req, res, next)
)

/**
 * @description DELETE /api/school-sources/:id - 删除院校官方源
 */
router.delete('/:id', validate(schoolSourceIdParamSchema, 'params'), (req, res, next) =>
  controller.remove(req, res, next)
)

export { router as schoolSourceRoutes }
