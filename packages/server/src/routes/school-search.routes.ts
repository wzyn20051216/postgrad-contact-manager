import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { SchoolSearchController } from '../controllers/school-search.controller.js'
import { schoolSearchQuerySchema } from '../validators/school-search.validator.js'

const router: Router = Router()
const controller = new SchoolSearchController()

router.use(authMiddleware)

/**
 * @description POST /api/school-search/query - 检索高校导师与招生信息
 */
router.post('/query', validate(schoolSearchQuerySchema), (req, res, next) =>
  controller.query(req, res, next)
)

export { router as schoolSearchRoutes }
