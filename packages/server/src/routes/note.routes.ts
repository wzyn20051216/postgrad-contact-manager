import { Router, type Router as RouterType } from 'express'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import { NoteController } from '../controllers/note.controller.js'

const router: RouterType = Router()
const ctrl = new NoteController()

router.use(authMiddleware)

router.get('/', ctrl.list.bind(ctrl))
router.get('/:id', ctrl.detail.bind(ctrl))
router.post('/', ctrl.create.bind(ctrl))
router.put('/:id', ctrl.update.bind(ctrl))
router.delete('/:id', ctrl.remove.bind(ctrl))

export { router as noteRoutes }
