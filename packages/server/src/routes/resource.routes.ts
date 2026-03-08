import { Router, type Router as RouterType } from 'express'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { ResourceController } from '../controllers/resource.controller.js'

const router: RouterType = Router()
const ctrl = new ResourceController()

router.use(authMiddleware)

router.get('/', ctrl.list.bind(ctrl))
router.get('/categories', ctrl.categories.bind(ctrl))
router.get('/check/report/latest', ctrl.latestHealthReport.bind(ctrl))
router.patch('/categories/rename', ctrl.renameCategory.bind(ctrl))
router.patch('/categories/merge', ctrl.mergeCategory.bind(ctrl))
router.post('/batch', ctrl.batchCreate.bind(ctrl))
router.post('/check', ctrl.checkHealthBatch.bind(ctrl))
router.get('/:id', ctrl.detail.bind(ctrl))
router.post('/', ctrl.create.bind(ctrl))
router.put('/:id', ctrl.update.bind(ctrl))
router.patch('/:id/pin', ctrl.togglePin.bind(ctrl))
router.post('/:id/visit', ctrl.recordVisit.bind(ctrl))
router.post('/:id/check', ctrl.checkHealth.bind(ctrl))
router.delete('/:id', ctrl.remove.bind(ctrl))

export { router as resourceRoutes }
