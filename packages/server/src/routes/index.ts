import type { Express } from 'express'
import { authRoutes } from './auth.routes.js'
import { professorRoutes } from './professor.routes.js'
import { interviewRoutes } from './interview.routes.js'
import { tagRoutes } from './tag.routes.js'
import { statsRoutes } from './stats.routes.js'
import { templateRoutes } from './template.routes.js'
import { noteRoutes } from './note.routes.js'
import { reminderRoutes } from './reminder.routes.js'
import { dataRoutes } from './data.routes.js'
import { resourceRoutes } from './resource.routes.js'
import { forumRoutes } from './forum.routes.js'
import { schoolSearchRoutes } from './school-search.routes.js'
import { schoolSourceRoutes } from './school-source.routes.js'

/** 注册所有路由 */
export function registerRoutes(app: Express): void {
  app.use('/api/auth', authRoutes)
  app.use('/api/professors', professorRoutes)
  app.use('/api/interviews', interviewRoutes)
  app.use('/api/tags', tagRoutes)
  app.use('/api/stats', statsRoutes)
  app.use('/api/templates', templateRoutes)
  app.use('/api/notes', noteRoutes)
  app.use('/api/reminders', reminderRoutes)
  app.use('/api/resources', resourceRoutes)
  app.use('/api/forum', forumRoutes)
  app.use('/api/school-search', schoolSearchRoutes)
  app.use('/api/school-sources', schoolSourceRoutes)
  app.use('/api/data', dataRoutes)

  /** @description 健康检查接口 */
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

}
