import { Prisma, type PrismaClient } from '@prisma/client'
import type { NextFunction, Request, Response } from 'express'
import { config } from '../config/index.js'
import { prisma } from '../config/database.js'
import { forumRealtimeService } from '../services/forum-realtime.service.js'
import { errorResponse, successResponse } from '../utils/response.js'

interface ForumPostBody {
  title?: string
  content?: string
  categoryId?: string | null
  isPinned?: boolean
}

interface ForumCommentBody {
  content?: string
  parentId?: string | null
}

interface ForumNotificationListQuery {
  limit?: string
}

interface ForumCommentTreeItem {
  id: string
  postId: string
  userId: string
  parentId: string | null
  content: string
  createdAt: Date
  updatedAt: Date
  canDelete: boolean
  user: {
    id: string
    email: string
    nickname: string | null
    avatar: string | null
    githubUsername: string | null
  }
  replies: ForumCommentTreeItem[]
}

interface MentionNotificationInput {
  mentionText: string
  actorUserId: string
  actorDisplayName: string
  postId: string
  postTitle: string
  commentId?: string
  blockedRecipientIds?: string[]
  mentionType: 'MENTIONED_IN_POST' | 'MENTIONED_IN_COMMENT'
}

const DEFAULT_FORUM_CATEGORIES = [
  {
    name: '经验交流',
    description: '联系导师、面试复盘与保研心得',
    sortOrder: 10,
  },
  {
    name: '资料互助',
    description: '共享简历、文书与学习资料',
    sortOrder: 20,
  },
  {
    name: '答疑求助',
    description: '提问交流、互相解答',
    sortOrder: 30,
  },
  {
    name: '信息速递',
    description: '发布通知、项目与时间节点信息',
    sortOrder: 40,
  },
]

const FORUM_USER_SELECT = {
  id: true,
  email: true,
  nickname: true,
  avatar: true,
  githubUsername: true,
} as const

const FORUM_CATEGORY_SELECT = {
  id: true,
  name: true,
  description: true,
  sortOrder: true,
} as const

const FORUM_NOTIFICATION_INCLUDE = {
  actorUser: {
    select: FORUM_USER_SELECT,
  },
  post: {
    select: {
      id: true,
      title: true,
    },
  },
  comment: {
    select: {
      id: true,
      content: true,
    },
  },
} as const

type ForumNotificationPayload = Prisma.ForumNotificationGetPayload<{
  include: typeof FORUM_NOTIFICATION_INCLUDE
}>

export class ForumController {
  /** @description 获取论坛分类 */
  async listCategories(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)

      await this.ensureDefaultCategories()
      const categories = await prisma.forumCategory.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      })
      return successResponse(res, categories)
    } catch (err) {
      return next(err)
    }
  }

  /** @description 获取帖子列表 */
  async listPosts(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)

      const categoryId = this.normalizeOptionalString(req.query.categoryId)
      const keyword = this.normalizeOptionalString(req.query.keyword)
      const mineOnly = this.parseBooleanQuery(req.query.mine)
      const sortType = this.parseSortType(req.query.sort)
      const isAdmin = this.isForumAdminByEmail(req.user.email)

      const where: Prisma.ForumPostWhereInput = {}
      if (categoryId) {
        where.categoryId = categoryId
      }
      if (mineOnly) {
        where.userId = req.user.id
      }
      if (keyword) {
        where.OR = [
          { title: { contains: keyword } },
          { content: { contains: keyword } },
        ]
      }

      const posts = await prisma.forumPost.findMany({
        where,
        include: {
          category: { select: FORUM_CATEGORY_SELECT },
          user: { select: FORUM_USER_SELECT },
          likes: {
            where: { userId: req.user.id },
            select: { userId: true },
          },
        },
        orderBy: this.resolveOrderBy(sortType),
      })

      const data = posts.map((item) => this.toPostResponse(item, req.user!.id, isAdmin))
      return successResponse(res, data)
    } catch (err) {
      return next(err)
    }
  }

  /** @description 获取帖子详情 */
  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)

      const id = String(req.params.id)
      const isAdmin = this.isForumAdminByEmail(req.user.email)
      const post = await prisma.forumPost.findUnique({
        where: { id },
        include: {
          category: { select: FORUM_CATEGORY_SELECT },
          user: { select: FORUM_USER_SELECT },
          likes: {
            where: { userId: req.user.id },
            select: { userId: true },
          },
        },
      })

      if (!post) return errorResponse(res, 'Post not found', 404)
      return successResponse(res, this.toPostResponse(post, req.user.id, isAdmin))
    } catch (err) {
      return next(err)
    }
  }

  /** @description 发布帖子（支持@提及提醒） */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)

      const isAdmin = this.isForumAdminByEmail(req.user.email)
      const body = req.body as ForumPostBody
      const title = this.normalizeRequiredString(body.title)
      const content = this.normalizeRequiredString(body.content)
      const categoryId = this.normalizeOptionalString(body.categoryId) ?? null
      const isPinned = Boolean(body.isPinned)

      if (!title) return errorResponse(res, 'title is required', 400)
      if (!content) return errorResponse(res, 'content is required', 400)
      if (title.length > 120) return errorResponse(res, 'title is too long', 400)
      if (content.length > 20000) return errorResponse(res, 'content is too long', 400)
      if (isPinned && !isAdmin) return errorResponse(res, 'Only admin can pin post', 403)

      if (categoryId) {
        const categoryExists = await this.isCategoryAvailable(categoryId)
        if (!categoryExists) return errorResponse(res, 'category not found', 404)
      }

      const txResult = await prisma.$transaction(async (tx) => {
        const created = await tx.forumPost.create({
          data: {
            title,
            content,
            categoryId,
            userId: req.user!.id,
            isPinned,
          },
          include: {
            category: { select: FORUM_CATEGORY_SELECT },
            user: { select: FORUM_USER_SELECT },
            likes: {
              where: { userId: req.user!.id },
              select: { userId: true },
            },
          },
        })

        const actorDisplayName = this.getActorDisplayName(created.user.nickname, req.user!.email)
        const mentionNotifications = await this.createMentionNotifications(tx, {
          mentionText: `${title}\n${content}`,
          actorUserId: req.user!.id,
          actorDisplayName,
          postId: created.id,
          postTitle: created.title,
          mentionType: 'MENTIONED_IN_POST',
        })

        return {
          created,
          mentionNotifications,
        }
      })

      this.emitRealtimeNotifications(txResult.mentionNotifications)
      return successResponse(res, this.toPostResponse(txResult.created, req.user.id, isAdmin), 'Created')
    } catch (err) {
      return next(err)
    }
  }

  /** @description 编辑帖子（作者或管理员） */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)

      const id = String(req.params.id)
      const exists = await prisma.forumPost.findUnique({
        where: { id },
        select: { id: true, userId: true },
      })
      if (!exists) return errorResponse(res, 'Post not found', 404)

      const isAdmin = this.isForumAdminByEmail(req.user.email)
      if (exists.userId !== req.user.id && !isAdmin) return errorResponse(res, 'Forbidden', 403)

      const body = req.body as ForumPostBody
      const data: Prisma.ForumPostUncheckedUpdateInput = {}

      if (body.title !== undefined) {
        const title = this.normalizeRequiredString(body.title)
        if (!title) return errorResponse(res, 'title is required', 400)
        if (title.length > 120) return errorResponse(res, 'title is too long', 400)
        data.title = title
      }

      if (body.content !== undefined) {
        const content = this.normalizeRequiredString(body.content)
        if (!content) return errorResponse(res, 'content is required', 400)
        if (content.length > 20000) return errorResponse(res, 'content is too long', 400)
        data.content = content
      }

      if (body.categoryId !== undefined) {
        const categoryId = this.normalizeOptionalString(body.categoryId) ?? null
        if (categoryId) {
          const categoryExists = await this.isCategoryAvailable(categoryId)
          if (!categoryExists) return errorResponse(res, 'category not found', 404)
        }
        data.categoryId = categoryId
      }

      if (body.isPinned !== undefined) {
        if (!isAdmin) return errorResponse(res, 'Only admin can pin post', 403)
        data.isPinned = Boolean(body.isPinned)
      }

      if (Object.keys(data).length === 0) {
        return errorResponse(res, 'No fields to update', 400)
      }

      const updated = await prisma.forumPost.update({
        where: { id },
        data,
        include: {
          category: { select: FORUM_CATEGORY_SELECT },
          user: { select: FORUM_USER_SELECT },
          likes: {
            where: { userId: req.user.id },
            select: { userId: true },
          },
        },
      })

      return successResponse(res, this.toPostResponse(updated, req.user.id, isAdmin), 'Updated')
    } catch (err) {
      return next(err)
    }
  }

  /** @description 删除帖子（作者或管理员） */
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)

      const id = String(req.params.id)
      const exists = await prisma.forumPost.findUnique({
        where: { id },
        select: { id: true, userId: true },
      })
      if (!exists) return errorResponse(res, 'Post not found', 404)

      const isAdmin = this.isForumAdminByEmail(req.user.email)
      if (exists.userId !== req.user.id && !isAdmin) return errorResponse(res, 'Forbidden', 403)

      await prisma.forumPost.delete({ where: { id } })
      return successResponse(res, null, 'Deleted')
    } catch (err) {
      return next(err)
    }
  }

  /** @description 获取帖子评论（树形） */
  async listComments(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)
      const postId = String(req.params.id)

      const post = await prisma.forumPost.findUnique({
        where: { id: postId },
        select: { id: true, userId: true },
      })
      if (!post) return errorResponse(res, 'Post not found', 404)

      const isAdmin = this.isForumAdminByEmail(req.user.email)
      const comments = await prisma.forumComment.findMany({
        where: { postId },
        include: {
          user: { select: FORUM_USER_SELECT },
        },
        orderBy: { createdAt: 'asc' },
      })

      const tree = this.buildCommentTree(comments, post.userId, req.user.id, isAdmin)
      return successResponse(res, tree)
    } catch (err) {
      return next(err)
    }
  }

  /** @description 发布评论（支持二级回复与@提及提醒） */
  async createComment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)
      const postId = String(req.params.id)
      const body = req.body as ForumCommentBody
      const content = this.normalizeRequiredString(body.content)
      const parentId = this.normalizeOptionalString(body.parentId) ?? null

      if (!content) return errorResponse(res, 'content is required', 400)
      if (content.length > 5000) return errorResponse(res, 'content is too long', 400)

      const txResult = await prisma.$transaction(async (tx) => {
        const post = await tx.forumPost.findUnique({
          where: { id: postId },
          select: {
            id: true,
            title: true,
            userId: true,
          },
        })
        if (!post) {
          throw new Error('FORUM_POST_NOT_FOUND')
        }

        let parentCommentOwnerId: string | null = null
        if (parentId) {
          const parentComment = await tx.forumComment.findFirst({
            where: { id: parentId, postId },
            select: { id: true, userId: true },
          })
          if (!parentComment) {
            throw new Error('FORUM_PARENT_COMMENT_NOT_FOUND')
          }
          parentCommentOwnerId = parentComment.userId
        }

        const comment = await tx.forumComment.create({
          data: {
            postId,
            userId: req.user!.id,
            content,
            parentId,
          },
          include: {
            user: { select: FORUM_USER_SELECT },
          },
        })

        const commentCount = await tx.forumComment.count({ where: { postId } })
        await tx.forumPost.update({
          where: { id: postId },
          data: { commentCount },
        })

        const actorDisplayName = this.getActorDisplayName(comment.user.nickname, req.user!.email)
        const createdNotifications: ForumNotificationPayload[] = []
        const blockedRecipientIds: string[] = []

        if (parentCommentOwnerId) {
          const replyNotification = await this.createNotificationIfNeeded(tx, {
            recipientUserId: parentCommentOwnerId,
            actorUserId: req.user!.id,
            postId,
            commentId: comment.id,
            type: 'COMMENT_REPLIED',
            content: `${actorDisplayName} 回复了你在《${post.title}》下的评论`,
          })
          if (replyNotification) {
            createdNotifications.push(replyNotification)
            blockedRecipientIds.push(parentCommentOwnerId)
          }
        }

        const postOwnerNotification = await this.createNotificationIfNeeded(tx, {
          recipientUserId: post.userId,
          actorUserId: req.user!.id,
          postId,
          commentId: comment.id,
          type: 'POST_COMMENTED',
          content: `${actorDisplayName} 评论了你的帖子《${post.title}》`,
          blockedRecipientIds,
        })
        if (postOwnerNotification) {
          createdNotifications.push(postOwnerNotification)
          blockedRecipientIds.push(post.userId)
        }

        const mentionNotifications = await this.createMentionNotifications(tx, {
          mentionText: content,
          actorUserId: req.user!.id,
          actorDisplayName,
          postId,
          postTitle: post.title,
          commentId: comment.id,
          blockedRecipientIds,
          mentionType: 'MENTIONED_IN_COMMENT',
        })
        createdNotifications.push(...mentionNotifications)

        return {
          comment,
          createdNotifications,
        }
      })

      this.emitRealtimeNotifications(txResult.createdNotifications)
      return successResponse(res, txResult.comment, 'Created')
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'FORUM_POST_NOT_FOUND') {
          return errorResponse(res, 'Post not found', 404)
        }
        if (err.message === 'FORUM_PARENT_COMMENT_NOT_FOUND') {
          return errorResponse(res, 'Parent comment not found', 404)
        }
      }
      return next(err)
    }
  }

  /** @description 删除评论（评论作者、帖子作者、管理员） */
  async removeComment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)
      const id = String(req.params.id)
      const isAdmin = this.isForumAdminByEmail(req.user.email)

      const comment = await prisma.forumComment.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          postId: true,
          post: {
            select: { userId: true },
          },
        },
      })
      if (!comment) return errorResponse(res, 'Comment not found', 404)

      const hasPermission = (
        comment.userId === req.user.id
        || comment.post.userId === req.user.id
        || isAdmin
      )
      if (!hasPermission) return errorResponse(res, 'Forbidden', 403)

      await prisma.$transaction(async (tx) => {
        await tx.forumComment.delete({ where: { id } })

        const commentCount = await tx.forumComment.count({
          where: { postId: comment.postId },
        })
        await tx.forumPost.update({
          where: { id: comment.postId },
          data: { commentCount },
        })
      })

      return successResponse(res, null, 'Deleted')
    } catch (err) {
      return next(err)
    }
  }

  /** @description 点赞帖子（通知作者并实时推送） */
  async likePost(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)
      const postId = String(req.params.id)

      const txResult = await prisma.$transaction(async (tx) => {
        const post = await tx.forumPost.findUnique({
          where: { id: postId },
          select: {
            id: true,
            title: true,
            userId: true,
          },
        })
        if (!post) {
          throw new Error('FORUM_POST_NOT_FOUND')
        }

        const exists = await tx.forumPostLike.findUnique({
          where: {
            postId_userId: {
              postId,
              userId: req.user!.id,
            },
          },
          select: { postId: true },
        })
        if (exists) {
          return {
            changed: false,
            notification: null,
          }
        }

        await tx.forumPostLike.create({
          data: {
            postId,
            userId: req.user!.id,
          },
        })

        const likeCount = await tx.forumPostLike.count({ where: { postId } })
        await tx.forumPost.update({
          where: { id: postId },
          data: { likeCount },
        })

        const notification = await this.createNotificationIfNeeded(tx, {
          recipientUserId: post.userId,
          actorUserId: req.user!.id,
          postId,
          type: 'POST_LIKED',
          content: `${req.user!.email} 点赞了你的帖子《${post.title}》`,
        })

        return {
          changed: true,
          notification,
        }
      })

      if (txResult.notification) {
        this.emitRealtimeNotifications([txResult.notification])
      }

      return successResponse(
        res,
        { liked: true, changed: txResult.changed },
        txResult.changed ? 'Liked' : 'Already liked'
      )
    } catch (err) {
      if (err instanceof Error && err.message === 'FORUM_POST_NOT_FOUND') {
        return errorResponse(res, 'Post not found', 404)
      }
      return next(err)
    }
  }

  /** @description 取消点赞 */
  async unlikePost(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)
      const postId = String(req.params.id)

      const changed = await prisma.$transaction(async (tx) => {
        const post = await tx.forumPost.findUnique({
          where: { id: postId },
          select: { id: true },
        })
        if (!post) {
          throw new Error('FORUM_POST_NOT_FOUND')
        }

        const exists = await tx.forumPostLike.findUnique({
          where: {
            postId_userId: {
              postId,
              userId: req.user!.id,
            },
          },
          select: { postId: true },
        })
        if (!exists) {
          return false
        }

        await tx.forumPostLike.delete({
          where: {
            postId_userId: {
              postId,
              userId: req.user!.id,
            },
          },
        })

        const likeCount = await tx.forumPostLike.count({ where: { postId } })
        await tx.forumPost.update({
          where: { id: postId },
          data: { likeCount },
        })

        return true
      })

      return successResponse(res, { liked: false, changed }, changed ? 'Unliked' : 'Already unliked')
    } catch (err) {
      if (err instanceof Error && err.message === 'FORUM_POST_NOT_FOUND') {
        return errorResponse(res, 'Post not found', 404)
      }
      return next(err)
    }
  }

  /** @description 获取站内通知 */
  async listNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)
      const isAdmin = this.isForumAdminByEmail(req.user.email)
      const query = req.query as ForumNotificationListQuery
      const limit = this.parseLimit(query.limit)

      const [items, unreadCount] = await Promise.all([
        prisma.forumNotification.findMany({
          where: { recipientUserId: req.user.id },
          include: FORUM_NOTIFICATION_INCLUDE,
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        prisma.forumNotification.count({
          where: {
            recipientUserId: req.user.id,
            isRead: false,
          },
        }),
      ])

      return successResponse(res, {
        items,
        unreadCount,
        isAdmin,
      })
    } catch (err) {
      return next(err)
    }
  }

  /** @description 标记单条通知为已读 */
  async markNotificationRead(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)
      const id = String(req.params.id)

      const notification = await prisma.forumNotification.findFirst({
        where: {
          id,
          recipientUserId: req.user.id,
        },
        select: {
          id: true,
          isRead: true,
        },
      })
      if (!notification) return errorResponse(res, 'Notification not found', 404)

      if (!notification.isRead) {
        await prisma.forumNotification.update({
          where: { id },
          data: {
            isRead: true,
            readAt: new Date(),
          },
        })
      }

      return successResponse(res, null, 'Updated')
    } catch (err) {
      return next(err)
    }
  }

  /** @description 全部通知标记为已读 */
  async markAllNotificationsRead(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401)

      const result = await prisma.forumNotification.updateMany({
        where: {
          recipientUserId: req.user.id,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      })

      return successResponse(res, { updatedCount: result.count }, 'Updated')
    } catch (err) {
      return next(err)
    }
  }

  /**
   * @description 构造帖子响应
   * @param item 帖子数据
   * @param currentUserId 当前用户 ID
   * @param isAdmin 是否管理员
   * @returns 帖子响应对象
   */
  private toPostResponse(
    item: {
      id: string
      categoryId: string | null
      userId: string
      title: string
      content: string
      isPinned: boolean
      viewCount: number
      commentCount: number
      likeCount: number
      createdAt: Date
      updatedAt: Date
      category: {
        id: string
        name: string
        description: string | null
        sortOrder: number
      } | null
      user: {
        id: string
        email: string
        nickname: string | null
        avatar: string | null
        githubUsername: string | null
      }
      likes: Array<{ userId: string }>
    },
    currentUserId: string,
    isAdmin: boolean
  ) {
    const { likes, ...rest } = item
    const likedByMe = likes.length > 0
    const isOwner = item.userId === currentUserId
    return {
      ...rest,
      likedByMe,
      permissions: {
        canEdit: isOwner || isAdmin,
        canDelete: isOwner || isAdmin,
        canPin: isAdmin,
      },
      isAdmin,
    }
  }

  /**
   * @description 构造评论树
   * @param comments 评论列表
   * @param postOwnerId 帖子作者 ID
   * @param currentUserId 当前用户 ID
   * @param isAdmin 是否管理员
   * @returns 评论树
   */
  private buildCommentTree(
    comments: Array<{
      id: string
      postId: string
      userId: string
      parentId: string | null
      content: string
      createdAt: Date
      updatedAt: Date
      user: {
        id: string
        email: string
        nickname: string | null
        avatar: string | null
        githubUsername: string | null
      }
    }>,
    postOwnerId: string,
    currentUserId: string,
    isAdmin: boolean
  ): ForumCommentTreeItem[] {
    const nodeMap = new Map<string, ForumCommentTreeItem>()
    const roots: ForumCommentTreeItem[] = []

    for (const item of comments) {
      nodeMap.set(item.id, {
        ...item,
        canDelete: item.userId === currentUserId || postOwnerId === currentUserId || isAdmin,
        replies: [],
      })
    }

    for (const item of comments) {
      const node = nodeMap.get(item.id)
      if (!node) continue

      if (item.parentId) {
        const parentNode = nodeMap.get(item.parentId)
        if (parentNode) {
          parentNode.replies.push(node)
          continue
        }
      }
      roots.push(node)
    }

    return roots
  }

  /**
   * @description 识别并创建@提及通知
   * @param db Prisma 客户端或事务实例
   * @param input 提及通知输入
   * @returns 已创建通知列表
   */
  private async createMentionNotifications(
    db: Prisma.TransactionClient | PrismaClient,
    input: MentionNotificationInput
  ): Promise<ForumNotificationPayload[]> {
    const mentionedUsers = await this.resolveMentionedUsers(db, input.mentionText)
    if (mentionedUsers.length === 0) {
      return []
    }

    const notifications: ForumNotificationPayload[] = []
    for (const user of mentionedUsers) {
      const notification = await this.createNotificationIfNeeded(db, {
        recipientUserId: user.id,
        actorUserId: input.actorUserId,
        postId: input.postId,
        commentId: input.commentId,
        type: input.mentionType,
        content: input.mentionType === 'MENTIONED_IN_POST'
          ? `${input.actorDisplayName} 在帖子《${input.postTitle}》中提到了你`
          : `${input.actorDisplayName} 在《${input.postTitle}》的评论中提到了你`,
        blockedRecipientIds: input.blockedRecipientIds,
      })
      if (notification) {
        notifications.push(notification)
      }
    }

    return notifications
  }

  /**
   * @description 创建通知（自动处理屏蔽和自通知）
   * @param db Prisma 客户端或事务实例
   * @param input 通知输入
   * @returns 已创建通知（带关联数据）
   */
  private async createNotificationIfNeeded(
    db: Prisma.TransactionClient | PrismaClient,
    input: {
      recipientUserId: string
      actorUserId: string
      postId?: string
      commentId?: string
      type: string
      content: string
      blockedRecipientIds?: string[]
    }
  ): Promise<ForumNotificationPayload | null> {
    const blockedSet = new Set(input.blockedRecipientIds ?? [])
    if (!input.recipientUserId || input.recipientUserId === input.actorUserId) {
      return null
    }
    if (blockedSet.has(input.recipientUserId)) {
      return null
    }

    const notification = await db.forumNotification.create({
      data: {
        recipientUserId: input.recipientUserId,
        actorUserId: input.actorUserId,
        postId: input.postId,
        commentId: input.commentId,
        type: input.type,
        content: input.content,
      },
      include: FORUM_NOTIFICATION_INCLUDE,
    })
    return notification
  }

  /**
   * @description 解析@提及用户
   * @param db Prisma 客户端或事务实例
   * @param text 文本内容
   * @returns 被提及用户集合
   */
  private async resolveMentionedUsers(
    db: Prisma.TransactionClient | PrismaClient,
    text: string
  ): Promise<Array<{ id: string }>> {
    const keywords = this.extractMentionKeywords(text)
    if (keywords.length === 0) {
      return []
    }

    const whereOr: Prisma.UserWhereInput[] = []
    for (const keyword of keywords) {
      whereOr.push({ nickname: keyword })
      whereOr.push({ githubUsername: keyword })
      whereOr.push({ email: { startsWith: `${keyword}@` } })
    }

    const users = await db.user.findMany({
      where: { OR: whereOr },
      select: {
        id: true,
        email: true,
        nickname: true,
        githubUsername: true,
      },
    })

    const keywordSet = new Set(keywords.map((item) => item.toLowerCase()))
    const userIdSet = new Set<string>()
    const result: Array<{ id: string }> = []

    for (const user of users) {
      const nickname = (user.nickname || '').trim().toLowerCase()
      const githubUsername = (user.githubUsername || '').trim().toLowerCase()
      const emailPrefix = user.email.split('@')[0]?.trim().toLowerCase() || ''

      const isMatched = (
        keywordSet.has(nickname)
        || keywordSet.has(githubUsername)
        || keywordSet.has(emailPrefix)
      )
      if (!isMatched) {
        continue
      }
      if (userIdSet.has(user.id)) {
        continue
      }

      userIdSet.add(user.id)
      result.push({ id: user.id })
    }

    return result
  }

  /**
   * @description 提取文本中的@关键字
   * @param text 文本内容
   * @returns 关键字列表
   */
  private extractMentionKeywords(text: string): string[] {
    const normalizedText = text.trim()
    if (!normalizedText) {
      return []
    }

    const maxMentions = 20
    const maxKeywordLength = 64
    const mentionTerminators = new Set([
      '@',
      '\uFF20',
      ',',
      '.',
      '!',
      '?',
      ';',
      ':',
      '(',
      ')',
      '[',
      ']',
      '{',
      '}',
      '<',
      '>',
      '"',
      '\'',
      '`',
      '~',
      '|',
      '\\',
      '/',
      '+',
      '=',
      '*',
      '#',
      '$',
      '%',
      '^',
      '&',
      '\uFF0C',
      '\u3002',
      '\uFF01',
      '\uFF1F',
      '\uFF1B',
      '\uFF1A',
      '\uFF08',
      '\uFF09',
      '\u3010',
      '\u3011',
      '\u300A',
      '\u300B',
      '\u300C',
      '\u300D',
      '\u3001',
      '\u2026',
    ])
    const isMentionBoundary = (char: string): boolean => {
      if (!char) {
        return true
      }
      if (/\s/u.test(char)) {
        return true
      }
      return mentionTerminators.has(char)
    }

    const keywordSet = new Set<string>()
    for (let index = 0; index < normalizedText.length; index += 1) {
      const currentChar = normalizedText[index]
      if (currentChar !== '@' && currentChar !== '\uFF20') {
        continue
      }

      const previousChar = index > 0 ? normalizedText[index - 1] : ''
      if (!isMentionBoundary(previousChar)) {
        continue
      }

      let cursor = index + 1
      let keyword = ''
      while (cursor < normalizedText.length && keyword.length < maxKeywordLength) {
        const nextChar = normalizedText[cursor]
        if (isMentionBoundary(nextChar)) {
          break
        }
        keyword += nextChar
        cursor += 1
      }

      const normalizedKeyword = keyword.trim().replace(/^[._-]+|[._-]+$/gu, '')
      if (normalizedKeyword) {
        keywordSet.add(normalizedKeyword)
        if (keywordSet.size >= maxMentions) {
          break
        }
      }

      index = cursor
    }

    return Array.from(keywordSet)
  }

  /**
   * @description 实时推送新通知
   * @param notifications 通知列表
   */
  private emitRealtimeNotifications(notifications: ForumNotificationPayload[]) {
    for (const item of notifications) {
      forumRealtimeService.publishNotification(item.recipientUserId, item)
    }
  }

  /** @description 确保默认分类存在 */
  private async ensureDefaultCategories() {
    await Promise.all(
      DEFAULT_FORUM_CATEGORIES.map((item) =>
        prisma.forumCategory.upsert({
          where: { name: item.name },
          create: item,
          update: {
            description: item.description,
            sortOrder: item.sortOrder,
            isActive: true,
          },
        })
      )
    )
  }

  /**
   * @description 判断分类是否可用
   * @param categoryId 分类 ID
   * @returns 是否存在且启用
   */
  private async isCategoryAvailable(categoryId: string): Promise<boolean> {
    const category = await prisma.forumCategory.findFirst({
      where: { id: categoryId, isActive: true },
      select: { id: true },
    })
    return Boolean(category)
  }

  /**
   * @description 判断是否论坛管理员
   * @param email 用户邮箱
   * @returns 是否管理员
   */
  private isForumAdminByEmail(email: string): boolean {
    const normalized = email.trim().toLowerCase()
    return config.forumAdminEmails.includes(normalized)
  }

  /**
   * @description 获取展示名
   * @param nickname 用户昵称
   * @param email 用户邮箱
   * @returns 展示名
   */
  private getActorDisplayName(nickname: string | null, email: string): string {
    const normalizedNickname = this.normalizeOptionalString(nickname)
    return normalizedNickname || email
  }

  /**
   * @description 解析排序参数
   * @param value 查询值
   * @returns 排序类型
   */
  private parseSortType(value: unknown): 'latest' | 'hot' | 'active' {
    if (typeof value !== 'string') {
      return 'latest'
    }

    const normalized = value.trim().toLowerCase()
    if (normalized === 'hot') return 'hot'
    if (normalized === 'active') return 'active'
    return 'latest'
  }

  /**
   * @description 生成排序规则
   * @param sortType 排序类型
   * @returns Prisma 排序规则
   */
  private resolveOrderBy(sortType: 'latest' | 'hot' | 'active'): Prisma.ForumPostOrderByWithRelationInput[] {
    if (sortType === 'hot') {
      return [
        { isPinned: 'desc' },
        { likeCount: 'desc' },
        { commentCount: 'desc' },
        { createdAt: 'desc' },
      ]
    }
    if (sortType === 'active') {
      return [
        { isPinned: 'desc' },
        { updatedAt: 'desc' },
      ]
    }
    return [
      { isPinned: 'desc' },
      { createdAt: 'desc' },
    ]
  }

  /**
   * @description 归一化可选字符串
   * @param value 输入值
   * @returns 去空白后文本
   */
  private normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : undefined
  }

  /**
   * @description 归一化必填字符串
   * @param value 输入值
   * @returns 去空白后文本
   */
  private normalizeRequiredString(value: unknown): string {
    if (typeof value !== 'string') return ''
    return value.trim()
  }

  /**
   * @description 解析布尔查询参数
   * @param value 查询参数
   * @returns 布尔值
   */
  private parseBooleanQuery(value: unknown): boolean {
    if (typeof value === 'boolean') return value
    if (typeof value !== 'string') return false
    return ['1', 'true', 'yes', 'y', 'on'].includes(value.trim().toLowerCase())
  }

  /**
   * @description 解析通知分页大小
   * @param rawLimit 原始输入
   * @returns 限制数量
   */
  private parseLimit(rawLimit: string | undefined): number {
    const parsed = Number.parseInt(rawLimit || '', 10)
    if (!Number.isFinite(parsed)) {
      return 30
    }
    return Math.min(Math.max(parsed, 1), 100)
  }
}
