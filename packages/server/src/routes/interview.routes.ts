import { Router } from 'express'
import { InterviewController } from '../controllers/interview.controller.js'
import { InterviewLogController } from '../controllers/interview-log.controller.js'
import { authMiddleware } from '../middlewares/auth.js'

const router: Router = Router()
const interviewController = new InterviewController()
const interviewLogController = new InterviewLogController()

router.use(authMiddleware)

/** @description GET /api/interviews - 获取面试列表 */
router.get('/', (req, res, next) => interviewController.list(req, res, next))

/** @description GET /api/interviews/:id - 获取面试详情 */
router.get('/:id', (req, res, next) => interviewController.detail(req, res, next))

/** @description POST /api/interviews - 创建面试 */
router.post('/', (req, res, next) => interviewController.create(req, res, next))

/** @description PUT /api/interviews/:id - 更新面试 */
router.put('/:id', (req, res, next) => interviewController.update(req, res, next))

/** @description DELETE /api/interviews/:id - 删除面试 */
router.delete('/:id', (req, res, next) => interviewController.remove(req, res, next))

/** @description PATCH /api/interviews/:id/status - 更新面试状态 */
router.patch('/:id/status', (req, res, next) => interviewController.updateStatus(req, res, next))

/** @description GET /api/interviews/:interviewId/logs - 获取面试日志列表 */
router.get('/:interviewId/logs', (req, res, next) => interviewLogController.list(req, res, next))

/** @description POST /api/interviews/:interviewId/logs - 创建面试日志 */
router.post('/:interviewId/logs', (req, res, next) => interviewLogController.create(req, res, next))

/** @description PUT /api/interviews/:interviewId/logs/:id - 更新面试日志 */
router.put('/:interviewId/logs/:id', (req, res, next) => interviewLogController.update(req, res, next))

/** @description DELETE /api/interviews/:interviewId/logs/:id - 删除面试日志 */
router.delete('/:interviewId/logs/:id', (req, res, next) => interviewLogController.remove(req, res, next))

export { router as interviewRoutes }
