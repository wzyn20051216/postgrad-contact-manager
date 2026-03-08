import type { IncomingMessage, Server as HttpServer } from 'node:http'
import type { Socket } from 'node:net'
import type { User } from '@prisma/client'
import { WebSocket, WebSocketServer } from 'ws'
import { prisma } from '../config/database.js'
import { verifyToken } from '../utils/token.js'

type AuthedWebSocket = WebSocket & {
  userId?: string
}

interface ForumRealtimeMessage {
  type: 'FORUM_NOTIFICATION_CREATED'
  data: unknown
}

/**
 * @description 论坛实时推送服务（WebSocket）
 */
class ForumRealtimeService {
  private readonly socketUserMap = new Map<string, Set<AuthedWebSocket>>()
  private webSocketServer: WebSocketServer | null = null
  private isAttached = false

  /**
   * @description 挂载到 HTTP Server
   * @param server Node HTTP Server
   */
  attach(server: HttpServer) {
    if (this.isAttached) {
      return
    }

    const webSocketServer = new WebSocketServer({
      noServer: true,
    })

    webSocketServer.on('connection', (socket: AuthedWebSocket) => {
      socket.on('close', () => {
        this.removeSocket(socket)
      })
    })

    server.on('upgrade', (request: IncomingMessage, socket: Socket, head: Buffer) => {
      void this.handleUpgrade(request, socket, head, webSocketServer)
    })

    this.webSocketServer = webSocketServer
    this.isAttached = true
  }

  /**
   * @description 向指定用户推送通知
   * @param userId 接收者用户 ID
   * @param notification 通知数据
   */
  publishNotification(userId: string, notification: unknown) {
    const socketSet = this.socketUserMap.get(userId)
    if (!socketSet || socketSet.size === 0) {
      return
    }

    const payload: ForumRealtimeMessage = {
      type: 'FORUM_NOTIFICATION_CREATED',
      data: notification,
    }
    const data = JSON.stringify(payload)

    for (const socket of socketSet) {
      if (socket.readyState !== WebSocket.OPEN) {
        continue
      }
      socket.send(data)
    }
  }

  /**
   * @description 处理 WebSocket 升级请求
   * @param request 请求对象
   * @param socket 原始 Socket
   * @param head 头缓冲区
   * @param webSocketServer WebSocketServer 实例
   */
  private async handleUpgrade(
    request: IncomingMessage,
    socket: Socket,
    head: Buffer,
    webSocketServer: WebSocketServer
  ) {
    const requestUrl = request.url || '/'
    const url = new URL(requestUrl, 'http://localhost')
    if (url.pathname !== '/api/forum/ws') {
      socket.destroy()
      return
    }

    const token = url.searchParams.get('token')
    if (!token) {
      this.rejectUpgrade(socket, 'Missing token')
      return
    }

    const currentUser = await this.resolveCurrentUser(token)
    if (!currentUser) {
      this.rejectUpgrade(socket, 'Invalid token')
      return
    }

    webSocketServer.handleUpgrade(request, socket, head, (webSocket: WebSocket) => {
      const authedSocket = webSocket as AuthedWebSocket
      authedSocket.userId = currentUser.id
      this.addSocket(currentUser.id, authedSocket)
      webSocketServer.emit('connection', authedSocket, request)
    })
  }

  /**
   * @description 校验 token 并获取当前用户
   * @param token JWT token
   * @returns 用户信息
   */
  private async resolveCurrentUser(token: string): Promise<Pick<User, 'id' | 'tokenVersion'> | null> {
    try {
      const payload = verifyToken(token)
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: {
          id: true,
          tokenVersion: true,
        },
      })

      if (!user) {
        return null
      }
      if (user.tokenVersion !== payload.tokenVersion) {
        return null
      }
      return user
    } catch {
      return null
    }
  }

  /**
   * @description 拒绝升级连接
   * @param socket 原始 Socket
   * @param message 提示信息
   */
  private rejectUpgrade(socket: Socket, message: string) {
    socket.write(`HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\n\r\n${message}`)
    socket.destroy()
  }

  /**
   * @description 记录新连接
   * @param userId 用户 ID
   * @param socket WebSocket 连接
   */
  private addSocket(userId: string, socket: AuthedWebSocket) {
    const socketSet = this.socketUserMap.get(userId) ?? new Set<AuthedWebSocket>()
    socketSet.add(socket)
    this.socketUserMap.set(userId, socketSet)
  }

  /**
   * @description 移除失效连接
   * @param socket WebSocket 连接
   */
  private removeSocket(socket: AuthedWebSocket) {
    const userId = socket.userId
    if (!userId) {
      return
    }
    const socketSet = this.socketUserMap.get(userId)
    if (!socketSet) {
      return
    }
    socketSet.delete(socket)
    if (socketSet.size === 0) {
      this.socketUserMap.delete(userId)
    }
  }
}

export const forumRealtimeService = new ForumRealtimeService()
