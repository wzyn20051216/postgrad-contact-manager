import { createServer } from 'node:http'
import { createApp } from './app.js'
import { config } from './config/index.js'
import { forumRealtimeService } from './services/forum-realtime.service.js'
import { resourceHealthScheduler } from './services/resource-health-scheduler.service.js'

const app = createApp()
const server = createServer(app)

forumRealtimeService.attach(server)

server.listen(config.port, () => {
  console.log(`[服务器] 已启动，端口: ${config.port}`)
  console.log(`[服务器] 地址: http://localhost:${config.port}`)
  console.log(`[Forum WS] 地址: ws://localhost:${config.port}/api/forum/ws`)
  resourceHealthScheduler.start()
})
