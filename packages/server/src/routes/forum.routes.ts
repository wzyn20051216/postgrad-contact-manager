import { Router, type Router as RouterType } from 'express'
import { ForumController } from '../controllers/forum.controller.js'
import { authMiddleware } from '../middlewares/auth.middleware.js'

const router: RouterType = Router()
const ctrl = new ForumController()

router.use(authMiddleware)

router.get('/categories', ctrl.listCategories.bind(ctrl))

router.get('/posts', ctrl.listPosts.bind(ctrl))
router.get('/posts/:id', ctrl.detail.bind(ctrl))
router.post('/posts', ctrl.create.bind(ctrl))
router.put('/posts/:id', ctrl.update.bind(ctrl))
router.delete('/posts/:id', ctrl.remove.bind(ctrl))

router.get('/posts/:id/comments', ctrl.listComments.bind(ctrl))
router.post('/posts/:id/comments', ctrl.createComment.bind(ctrl))
router.delete('/comments/:id', ctrl.removeComment.bind(ctrl))

router.post('/posts/:id/like', ctrl.likePost.bind(ctrl))
router.delete('/posts/:id/like', ctrl.unlikePost.bind(ctrl))

router.get('/notifications', ctrl.listNotifications.bind(ctrl))
router.patch('/notifications/:id/read', ctrl.markNotificationRead.bind(ctrl))
router.post('/notifications/read-all', ctrl.markAllNotificationsRead.bind(ctrl))

export { router as forumRoutes }
