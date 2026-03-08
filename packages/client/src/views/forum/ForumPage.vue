<template>
  <div class="app-page forum-page">
    <div class="app-page-header">
      <n-page-header title="论坛交流区" subtitle="发帖交流、二级回复、消息通知一体化协作" />
      <n-space>
        <n-badge :value="unreadCount" :max="99" :show-zero="false">
          <n-button @click="handleOpenNotificationDrawer">消息中心</n-button>
        </n-badge>
        <n-button type="primary" @click="handleOpenCreateModal">
          发布帖子
        </n-button>
      </n-space>
    </div>

    <n-card class="app-card">
      <div class="app-toolbar">
        <div class="app-toolbar__left">
          <n-input
            v-model:value="filterModel.keyword"
            placeholder="搜索标题或正文内容"
            clearable
            style="width: 260px"
            @keyup.enter="handleSearch"
          />
          <n-select
            v-model:value="filterModel.categoryId"
            :options="categoryOptions"
            style="width: 180px"
          />
          <n-select
            v-model:value="filterModel.sort"
            :options="sortOptions"
            style="width: 150px"
          />
          <n-checkbox v-model:checked="filterModel.mine">
            只看我的
          </n-checkbox>
        </div>
        <div class="app-toolbar__right">
          <n-button @click="handleResetFilter">重置</n-button>
          <n-button type="primary" @click="handleSearch">查询</n-button>
        </div>
      </div>
    </n-card>

    <div class="forum-layout">
      <n-card class="app-card forum-list-card" title="帖子列表">
        <template #header-extra>
          <n-button text @click="handleSearch">刷新</n-button>
        </template>

        <n-spin :show="postsLoading">
          <n-empty
            v-if="!postsLoading && postList.length === 0"
            class="app-empty"
            description="还没有帖子，快来发布第一条吧"
          />

          <div v-else class="forum-post-list">
            <button
              v-for="item in postList"
              :key="item.id"
              type="button"
              class="forum-post-item"
              :class="{ 'forum-post-item--active': item.id === selectedPostId }"
              @click="handleSelectPost(item.id)"
            >
              <div class="forum-post-item__title">
                <span>{{ item.title }}</span>
                <n-tag v-if="item.isPinned" size="small" type="warning" :bordered="false">
                  置顶
                </n-tag>
              </div>
              <div class="forum-post-item__meta">
                <span>{{ getDisplayName(item.user) }}</span>
                <span>{{ formatDateTime(item.createdAt) }}</span>
                <span>{{ item.category?.name || '未分类' }}</span>
              </div>
              <p class="forum-post-item__excerpt">{{ item.content }}</p>
              <div class="forum-post-item__stats">
                <span>💬 {{ item.commentCount }}</span>
                <span>👍 {{ item.likeCount }}</span>
                <span>📌 {{ item.isPinned ? '已置顶' : '普通帖' }}</span>
              </div>
            </button>
          </div>
        </n-spin>
      </n-card>

      <n-card class="app-card forum-detail-card">
        <template #header>
          <span>帖子详情</span>
        </template>
        <template #header-extra>
          <n-space v-if="postDetail" :size="8">
            <n-button size="small" tertiary type="primary" @click="handleToggleLike">
              {{ postDetail.likedByMe ? '取消点赞' : '点赞' }}
            </n-button>
            <n-button v-if="postDetail.permissions.canEdit" size="small" @click="handleOpenEditModal">
              编辑
            </n-button>
            <n-popconfirm v-if="postDetail.permissions.canDelete" @positive-click="handleDeleteSelectedPost">
              <template #trigger>
                <n-button size="small" type="error" secondary>删除</n-button>
              </template>
              确认删除该帖子吗？
            </n-popconfirm>
          </n-space>
        </template>

        <n-spin :show="detailLoading">
          <n-empty
            v-if="!postDetail"
            class="app-empty"
            description="请从左侧选择一个帖子查看详情"
          />

          <div v-else class="forum-detail-main">
            <h3 class="forum-detail-main__title">
              {{ postDetail.title }}
              <n-tag v-if="postDetail.isPinned" size="small" type="warning" :bordered="false">
                置顶
              </n-tag>
            </h3>
            <div class="forum-detail-main__meta">
              <span>作者：{{ getDisplayName(postDetail.user) }}</span>
              <span>发布时间：{{ formatDateTime(postDetail.createdAt) }}</span>
              <span>分类：{{ postDetail.category?.name || '未分类' }}</span>
            </div>
            <div class="forum-detail-main__stats">
              <span>💬 {{ postDetail.commentCount }}</span>
              <span>👍 {{ postDetail.likeCount }}</span>
              <span>👀 {{ postDetail.viewCount }}</span>
            </div>
            <n-divider />
            <article class="forum-detail-main__content">{{ postDetail.content }}</article>

            <n-divider />

            <section class="forum-comments">
              <h4 class="forum-comments__title">评论区</h4>
              <div v-if="replyTarget" class="forum-reply-target">
                <span>正在回复：{{ replyTarget.author }}</span>
                <n-button text type="warning" size="small" @click="clearReplyTarget">取消回复</n-button>
              </div>

              <n-input
                v-model:value="commentInput"
                type="textarea"
                placeholder="写下你的观点，支持多行输入"
                :autosize="{ minRows: 3, maxRows: 6 }"
              />
              <div class="forum-comments__actions">
                <n-button type="primary" :loading="commentSubmitting" @click="handleCreateComment">
                  {{ replyTarget ? '发表回复' : '发表评论' }}
                </n-button>
              </div>

              <n-spin :show="commentsLoading">
                <n-empty
                  v-if="displayComments.length === 0"
                  description="暂无评论，欢迎来聊聊你的想法"
                  class="forum-comments__empty"
                />
                <div v-else class="forum-comment-list">
                  <div
                    v-for="comment in displayComments"
                    :key="comment.id"
                    class="forum-comment-item"
                    :style="{ marginLeft: `${Math.min(comment.depth, 4) * 24}px` }"
                  >
                    <div class="forum-comment-item__head">
                      <div class="forum-comment-item__meta">
                        <span class="forum-comment-item__author">{{ getDisplayName(comment.user) }}</span>
                        <span>{{ formatDateTime(comment.createdAt) }}</span>
                        <n-tag v-if="comment.depth > 0" size="small" :bordered="false">回复</n-tag>
                      </div>

                      <n-space :size="8">
                        <n-button text size="tiny" type="primary" @click="setReplyTarget(comment)">
                          回复
                        </n-button>
                        <n-popconfirm
                          v-if="comment.canDelete"
                          @positive-click="handleDeleteComment(comment)"
                        >
                          <template #trigger>
                            <n-button text type="error" size="tiny">删除</n-button>
                          </template>
                          确认删除该评论吗？
                        </n-popconfirm>
                      </n-space>
                    </div>
                    <p class="forum-comment-item__content">{{ comment.content }}</p>
                  </div>
                </div>
              </n-spin>
            </section>
          </div>
        </n-spin>
      </n-card>
    </div>

    <n-modal
      v-model:show="showEditorModal"
      preset="card"
      :title="editingPostId ? '编辑帖子' : '发布帖子'"
      style="width: min(840px, 92vw)"
      :mask-closable="false"
      @after-leave="resetEditorState"
    >
      <n-form
        ref="editorFormRef"
        :model="editorForm"
        :rules="editorRules"
        label-placement="top"
        require-mark-placement="right-hanging"
      >
        <n-form-item label="标题" path="title">
          <n-input
            v-model:value="editorForm.title"
            maxlength="120"
            show-count
            placeholder="请输入帖子标题（最多 120 字）"
          />
        </n-form-item>

        <n-form-item label="分类">
          <n-select
            v-model:value="editorForm.categoryId"
            :options="editorCategoryOptions"
            clearable
            placeholder="可选，未选择时归入“未分类”"
          />
        </n-form-item>

        <n-form-item label="正文" path="content">
          <n-input
            v-model:value="editorForm.content"
            type="textarea"
            :autosize="{ minRows: 10, maxRows: 20 }"
            maxlength="20000"
            show-count
            placeholder="支持长文输入，建议按段落组织内容"
          />
        </n-form-item>

        <n-form-item v-if="viewerIsAdmin" label="置顶显示（管理员）">
          <n-switch v-model:value="editorForm.isPinned" />
        </n-form-item>
      </n-form>

      <template #footer>
        <div class="forum-editor-footer">
          <n-button @click="showEditorModal = false">取消</n-button>
          <n-button type="primary" :loading="postSubmitting" @click="handleSubmitPost">
            保存
          </n-button>
        </div>
      </template>
    </n-modal>

    <n-drawer v-model:show="showNotificationDrawer" :width="420" placement="right">
      <n-drawer-content title="消息中心" closable>
        <template #header-extra>
          <n-button text type="primary" @click="handleReadAllNotifications">全部已读</n-button>
        </template>

        <n-spin :show="notificationLoading">
          <n-empty v-if="notificationList.length === 0" description="暂无消息通知" />
          <div v-else class="forum-notification-list">
            <button
              v-for="item in notificationList"
              :key="item.id"
              type="button"
              class="forum-notification-item"
              :class="{ 'forum-notification-item--unread': !item.isRead }"
              @click="handleOpenNotification(item)"
            >
              <div class="forum-notification-item__head">
                <span>{{ item.content }}</span>
                <n-tag v-if="!item.isRead" size="small" type="warning" :bordered="false">未读</n-tag>
              </div>
              <div class="forum-notification-item__meta">
                <span>{{ formatDateTime(item.createdAt) }}</span>
                <span v-if="item.post">帖子：{{ item.post.title }}</span>
              </div>
            </button>
          </div>
        </n-spin>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useMessage, type FormInst, type FormRules } from 'naive-ui'
import {
  forumApi,
  type ForumCategory,
  type ForumCommentItem,
  type ForumNotificationItem,
  type ForumPostItem,
  type ForumUserSummary,
} from '@/api'

type ForumSortType = 'latest' | 'hot' | 'active'

interface ForumFilterModel {
  keyword: string
  categoryId: string
  sort: ForumSortType
  mine: boolean
}

interface ForumEditorModel {
  title: string
  categoryId: string | null
  content: string
  isPinned: boolean
}

interface ForumReplyTarget {
  id: string
  author: string
}

interface DisplayComment extends ForumCommentItem {
  depth: number
}

interface ForumRealtimeMessage {
  type: 'FORUM_NOTIFICATION_CREATED'
  data: ForumNotificationItem
}

const message = useMessage()

const categories = ref<ForumCategory[]>([])
const postList = ref<ForumPostItem[]>([])
const postDetail = ref<ForumPostItem | null>(null)
const commentTree = ref<ForumCommentItem[]>([])

const notificationList = ref<ForumNotificationItem[]>([])
const unreadCount = ref(0)

const postsLoading = ref(false)
const detailLoading = ref(false)
const commentsLoading = ref(false)
const postSubmitting = ref(false)
const commentSubmitting = ref(false)
const notificationLoading = ref(false)

const viewerIsAdmin = ref(false)
const selectedPostId = ref<string | null>(null)
const commentInput = ref('')
const replyTarget = ref<ForumReplyTarget | null>(null)

const showEditorModal = ref(false)
const showNotificationDrawer = ref(false)
const editingPostId = ref<string | null>(null)
const editorFormRef = ref<FormInst | null>(null)
const realtimeSocket = ref<WebSocket | null>(null)
const realtimeReconnectTimer = ref<number | null>(null)
const realtimeClosedByUser = ref(false)

const filterModel = reactive<ForumFilterModel>({
  keyword: '',
  categoryId: 'ALL',
  sort: 'latest',
  mine: false,
})

const editorForm = reactive<ForumEditorModel>({
  title: '',
  categoryId: null,
  content: '',
  isPinned: false,
})

const editorRules: FormRules = {
  title: [
    { required: true, message: '请输入标题', trigger: ['blur', 'input'] },
  ],
  content: [
    { required: true, message: '请输入正文', trigger: ['blur', 'input'] },
  ],
}

const sortOptions = [
  { label: '最新发布', value: 'latest' },
  { label: '热度优先', value: 'hot' },
  { label: '最近活跃', value: 'active' },
]

const categoryOptions = computed(() => ([
  { label: '全部分类', value: 'ALL' },
  ...categories.value.map((item) => ({
    label: item.name,
    value: item.id,
  })),
]))

const editorCategoryOptions = computed(() =>
  categories.value.map((item) => ({
    label: item.name,
    value: item.id,
  }))
)

const displayComments = computed<DisplayComment[]>(() => {
  const flattened: DisplayComment[] = []

  const walk = (items: ForumCommentItem[], depth: number) => {
    for (const item of items) {
      flattened.push({
        ...item,
        depth,
      })
      if (item.replies.length > 0) {
        walk(item.replies, depth + 1)
      }
    }
  }

  walk(commentTree.value, 0)
  return flattened
})

/**
 * @description 提取接口错误提示
 * @param error 错误对象
 * @param fallback 兜底提示
 * @returns 可读错误消息
 */
function getApiErrorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback
}

/**
 * @description 时间格式化
 * @param value 原始时间字符串
 * @returns 展示文本
 */
function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleString('zh-CN')
}

/**
 * @description 获取用户展示名
 * @param user 用户信息
 * @returns 展示名
 */
function getDisplayName(user: ForumUserSummary): string {
  return user.nickname || user.githubUsername || user.email
}

/**
 * @description 构建论坛 WebSocket 地址
 * @returns 可连接地址
 */
function buildForumWebSocketUrl(): string | null {
  const token = localStorage.getItem('token')
  if (!token) {
    return null
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = import.meta.env.DEV ? 'localhost:3000' : window.location.host
  return `${protocol}://${host}/api/forum/ws?token=${encodeURIComponent(token)}`
}

/**
 * @description 安全关闭实时连接
 */
function closeForumRealtimeSocket() {
  if (!realtimeSocket.value) {
    return
  }
  realtimeSocket.value.close()
  realtimeSocket.value = null
}

/**
 * @description 清理重连定时器
 */
function clearRealtimeReconnectTimer() {
  if (realtimeReconnectTimer.value === null) {
    return
  }
  window.clearTimeout(realtimeReconnectTimer.value)
  realtimeReconnectTimer.value = null
}

/**
 * @description 延迟重连 WebSocket
 */
function scheduleForumRealtimeReconnect() {
  if (realtimeClosedByUser.value) {
    return
  }
  if (realtimeReconnectTimer.value !== null) {
    return
  }
  realtimeReconnectTimer.value = window.setTimeout(() => {
    realtimeReconnectTimer.value = null
    connectForumRealtimeSocket()
  }, 3000)
}

/**
 * @description 处理实时通知消息
 * @param notification 通知内容
 */
function handleRealtimeNotification(notification: ForumNotificationItem) {
  const existed = notificationList.value.some((item) => item.id === notification.id)
  if (existed) {
    return
  }

  notificationList.value = [notification, ...notificationList.value]
  if (!notification.isRead) {
    unreadCount.value += 1
  }

  if (showNotificationDrawer.value) {
    void fetchNotifications()
  }

  message.info('收到一条新的论坛通知')
}

/**
 * @description 建立论坛实时连接
 */
function connectForumRealtimeSocket() {
  if (realtimeSocket.value) {
    return
  }

  const wsUrl = buildForumWebSocketUrl()
  if (!wsUrl) {
    return
  }

  try {
    const socket = new WebSocket(wsUrl)
    realtimeSocket.value = socket

    socket.onopen = () => {
      clearRealtimeReconnectTimer()
    }

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as ForumRealtimeMessage
        if (payload.type === 'FORUM_NOTIFICATION_CREATED' && payload.data) {
          handleRealtimeNotification(payload.data)
        }
      } catch {
      }
    }

    socket.onclose = () => {
      realtimeSocket.value = null
      scheduleForumRealtimeReconnect()
    }

    socket.onerror = () => {
      closeForumRealtimeSocket()
      scheduleForumRealtimeReconnect()
    }
  } catch {
    scheduleForumRealtimeReconnect()
  }
}

/**
 * @description 构造帖子查询参数
 * @returns 查询参数对象
 */
function buildPostQuery() {
  return {
    keyword: filterModel.keyword.trim() || undefined,
    categoryId: filterModel.categoryId === 'ALL' ? undefined : filterModel.categoryId,
    sort: filterModel.sort,
    mine: filterModel.mine ? true : undefined,
  }
}

/**
 * @description 同步帖子到列表
 * @param post 帖子详情
 */
function upsertPostInList(post: ForumPostItem) {
  const index = postList.value.findIndex((item) => item.id === post.id)
  if (index >= 0) {
    postList.value[index] = post
    postList.value = [...postList.value]
    return
  }
  postList.value = [post, ...postList.value]
}

/**
 * @description 刷新分类
 */
async function fetchCategories() {
  try {
    const response = await forumApi.categories()
    categories.value = response.data.data
  } catch (error) {
    message.error(getApiErrorMessage(error, '获取论坛分类失败'))
  }
}

/**
 * @description 刷新通知列表
 */
async function fetchNotifications() {
  notificationLoading.value = true
  try {
    const response = await forumApi.notifications(60)
    notificationList.value = response.data.data.items
    unreadCount.value = response.data.data.unreadCount
    viewerIsAdmin.value = response.data.data.isAdmin
  } catch (error) {
    message.error(getApiErrorMessage(error, '获取通知失败'))
  } finally {
    notificationLoading.value = false
  }
}

/**
 * @description 刷新帖子列表
 */
async function fetchPosts() {
  postsLoading.value = true
  try {
    const response = await forumApi.posts(buildPostQuery())
    postList.value = response.data.data
    if (postList.value.length > 0) {
      viewerIsAdmin.value = postList.value[0].isAdmin
    }

    if (postList.value.length === 0) {
      selectedPostId.value = null
      postDetail.value = null
      commentTree.value = []
      return
    }

    const selectedStillExists = (
      selectedPostId.value
      && postList.value.some((item) => item.id === selectedPostId.value)
    )

    if (!selectedStillExists) {
      await loadPost(postList.value[0].id)
    } else if (selectedPostId.value && !postDetail.value) {
      await loadPost(selectedPostId.value)
    }
  } catch (error) {
    message.error(getApiErrorMessage(error, '获取帖子列表失败'))
  } finally {
    postsLoading.value = false
  }
}

/**
 * @description 仅刷新当前评论树
 */
async function reloadCurrentComments() {
  if (!selectedPostId.value) {
    commentTree.value = []
    return
  }
  commentsLoading.value = true
  try {
    const response = await forumApi.comments(selectedPostId.value)
    commentTree.value = response.data.data
  } catch (error) {
    message.error(getApiErrorMessage(error, '加载评论失败'))
  } finally {
    commentsLoading.value = false
  }
}

/**
 * @description 加载帖子详情与评论
 * @param postId 帖子 ID
 */
async function loadPost(postId: string) {
  selectedPostId.value = postId
  detailLoading.value = true
  commentsLoading.value = true
  try {
    const [postResponse, commentResponse] = await Promise.all([
      forumApi.detail(postId),
      forumApi.comments(postId),
    ])
    postDetail.value = postResponse.data.data
    viewerIsAdmin.value = postResponse.data.data.isAdmin
    commentTree.value = commentResponse.data.data
    upsertPostInList(postResponse.data.data)
  } catch (error) {
    message.error(getApiErrorMessage(error, '加载帖子详情失败'))
  } finally {
    detailLoading.value = false
    commentsLoading.value = false
  }
}

/**
 * @description 打开通知抽屉
 */
function handleOpenNotificationDrawer() {
  showNotificationDrawer.value = true
  void fetchNotifications()
}

/**
 * @description 全部通知标记已读
 */
async function handleReadAllNotifications() {
  try {
    await forumApi.readAllNotifications()
    unreadCount.value = 0
    notificationList.value = notificationList.value.map((item) => ({
      ...item,
      isRead: true,
    }))
    message.success('已全部标记为已读')
  } catch (error) {
    message.error(getApiErrorMessage(error, '操作失败'))
  }
}

/**
 * @description 打开单条通知并跳转到对应帖子
 * @param item 通知项
 */
async function handleOpenNotification(item: ForumNotificationItem) {
  try {
    if (!item.isRead) {
      await forumApi.readNotification(item.id)
      item.isRead = true
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }

    if (!item.postId) {
      return
    }
    showNotificationDrawer.value = false

    if (filterModel.keyword || filterModel.categoryId !== 'ALL' || filterModel.mine) {
      filterModel.keyword = ''
      filterModel.categoryId = 'ALL'
      filterModel.mine = false
      await fetchPosts()
    }

    await loadPost(item.postId)
  } catch (error) {
    message.error(getApiErrorMessage(error, '处理通知失败'))
  }
}

/**
 * @description 打开发布弹窗
 */
function handleOpenCreateModal() {
  editingPostId.value = null
  editorForm.title = ''
  editorForm.categoryId = null
  editorForm.content = ''
  editorForm.isPinned = false
  editorFormRef.value?.restoreValidation()
  showEditorModal.value = true
}

/**
 * @description 打开编辑弹窗
 */
function handleOpenEditModal() {
  if (!postDetail.value) {
    return
  }
  editingPostId.value = postDetail.value.id
  editorForm.title = postDetail.value.title
  editorForm.categoryId = postDetail.value.categoryId
  editorForm.content = postDetail.value.content
  editorForm.isPinned = postDetail.value.isPinned
  editorFormRef.value?.restoreValidation()
  showEditorModal.value = true
}

/**
 * @description 弹窗关闭后重置状态
 */
function resetEditorState() {
  editingPostId.value = null
  editorForm.title = ''
  editorForm.categoryId = null
  editorForm.content = ''
  editorForm.isPinned = false
  editorFormRef.value?.restoreValidation()
}

/**
 * @description 提交帖子
 */
async function handleSubmitPost() {
  if (postSubmitting.value) {
    return
  }

  try {
    await editorFormRef.value?.validate()
  } catch {
    return
  }

  const title = editorForm.title.trim()
  const content = editorForm.content.trim()

  if (!title || !content) {
    message.warning('标题和正文不能为空')
    return
  }

  const payload: {
    title: string
    content: string
    categoryId: string | null
    isPinned?: boolean
  } = {
    title,
    content,
    categoryId: editorForm.categoryId,
  }

  if (viewerIsAdmin.value) {
    payload.isPinned = editorForm.isPinned
  }

  postSubmitting.value = true
  try {
    if (editingPostId.value) {
      const response = await forumApi.update(editingPostId.value, payload)
      message.success('帖子更新成功')
      showEditorModal.value = false
      await loadPost(response.data.data.id)
      return
    }

    const response = await forumApi.create(payload)
    message.success('帖子发布成功')
    showEditorModal.value = false
    await loadPost(response.data.data.id)
    await fetchPosts()
  } catch (error) {
    message.error(getApiErrorMessage(error, editingPostId.value ? '更新帖子失败' : '发布帖子失败'))
  } finally {
    postSubmitting.value = false
  }
}

/**
 * @description 删除当前帖子
 */
async function handleDeleteSelectedPost() {
  if (!postDetail.value) {
    return
  }
  try {
    await forumApi.remove(postDetail.value.id)
    message.success('帖子已删除')
    await fetchPosts()
  } catch (error) {
    message.error(getApiErrorMessage(error, '删除帖子失败'))
  }
}

/**
 * @description 选中帖子
 * @param postId 帖子 ID
 */
async function handleSelectPost(postId: string) {
  if (!postId) {
    return
  }
  await loadPost(postId)
}

/**
 * @description 按当前筛选查询
 */
function handleSearch() {
  void fetchPosts()
}

/**
 * @description 重置筛选条件
 */
function handleResetFilter() {
  filterModel.keyword = ''
  filterModel.categoryId = 'ALL'
  filterModel.sort = 'latest'
  filterModel.mine = false
  void fetchPosts()
}

/**
 * @description 更新帖子列表中的指定帖子
 * @param postId 帖子 ID
 * @param updater 更新函数
 */
function updatePostListItem(postId: string, updater: (item: ForumPostItem) => ForumPostItem) {
  postList.value = postList.value.map((item) => (item.id === postId ? updater(item) : item))
}

/**
 * @description 点赞或取消点赞
 */
async function handleToggleLike() {
  if (!postDetail.value) {
    return
  }

  const targetPostId = postDetail.value.id
  const likedByMe = postDetail.value.likedByMe

  try {
    if (likedByMe) {
      await forumApi.unlike(targetPostId)
      postDetail.value = {
        ...postDetail.value,
        likedByMe: false,
        likeCount: Math.max(0, postDetail.value.likeCount - 1),
      }
      updatePostListItem(targetPostId, (item) => ({
        ...item,
        likedByMe: false,
        likeCount: Math.max(0, item.likeCount - 1),
      }))
      return
    }

    await forumApi.like(targetPostId)
    postDetail.value = {
      ...postDetail.value,
      likedByMe: true,
      likeCount: postDetail.value.likeCount + 1,
    }
    updatePostListItem(targetPostId, (item) => ({
      ...item,
      likedByMe: true,
      likeCount: item.likeCount + 1,
    }))
  } catch (error) {
    message.error(getApiErrorMessage(error, '更新点赞状态失败'))
  }
}

/**
 * @description 设定回复目标
 * @param comment 评论项
 */
function setReplyTarget(comment: ForumCommentItem) {
  replyTarget.value = {
    id: comment.id,
    author: getDisplayName(comment.user),
  }
}

/**
 * @description 清除回复目标
 */
function clearReplyTarget() {
  replyTarget.value = null
}

/**
 * @description 发表评论或回复
 */
async function handleCreateComment() {
  if (commentSubmitting.value || !selectedPostId.value) {
    return
  }

  const content = commentInput.value.trim()
  if (!content) {
    message.warning('评论内容不能为空')
    return
  }

  commentSubmitting.value = true
  try {
    await forumApi.createComment(selectedPostId.value, {
      content,
      parentId: replyTarget.value?.id || null,
    })
    commentInput.value = ''
    clearReplyTarget()
    await loadPost(selectedPostId.value)
    message.success('评论已发布')
  } catch (error) {
    message.error(getApiErrorMessage(error, '发表评论失败'))
  } finally {
    commentSubmitting.value = false
  }
}

/**
 * @description 删除评论
 * @param comment 评论数据
 */
async function handleDeleteComment(comment: ForumCommentItem) {
  if (!selectedPostId.value) {
    return
  }
  try {
    await forumApi.removeComment(comment.id)
    await loadPost(selectedPostId.value)
    message.success('评论已删除')
  } catch (error) {
    message.error(getApiErrorMessage(error, '删除评论失败'))
  }
}

onMounted(async () => {
  realtimeClosedByUser.value = false
  await Promise.all([
    fetchCategories(),
    fetchNotifications(),
    fetchPosts(),
  ])
  await reloadCurrentComments()
  connectForumRealtimeSocket()
})

onBeforeUnmount(() => {
  realtimeClosedByUser.value = true
  clearRealtimeReconnectTimer()
  closeForumRealtimeSocket()
})
</script>

<style scoped>
.forum-layout {
  display: grid;
  grid-template-columns: minmax(320px, 38%) 1fr;
  gap: 16px;
}

.forum-list-card,
.forum-detail-card {
  min-height: 640px;
}

.forum-post-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.forum-post-item {
  width: 100%;
  text-align: left;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 14px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.75);
  transition: all 0.2s ease;
  cursor: pointer;
}

.forum-post-item:hover {
  border-color: rgba(59, 130, 246, 0.45);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.forum-post-item--active {
  border-color: rgba(59, 130, 246, 0.75);
  background: rgba(239, 246, 255, 0.7);
}

.forum-post-item__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.forum-post-item__meta {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: #64748b;
}

.forum-post-item__excerpt {
  margin: 8px 0 0;
  color: #1f2937;
  font-size: 13px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.forum-post-item__stats {
  margin-top: 10px;
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #475569;
}

.forum-detail-main__title {
  margin: 0;
  font-size: 24px;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 8px;
}

.forum-detail-main__meta {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: #64748b;
}

.forum-detail-main__stats {
  margin-top: 8px;
  display: flex;
  gap: 12px;
  color: #475569;
  font-size: 13px;
}

.forum-detail-main__content {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.8;
  color: #1f2937;
  min-height: 120px;
}

.forum-comments__title {
  margin: 0 0 8px;
  font-size: 16px;
  color: #0f172a;
}

.forum-reply-target {
  margin-bottom: 8px;
  border-radius: 10px;
  border: 1px dashed rgba(251, 146, 60, 0.5);
  padding: 6px 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 247, 237, 0.72);
  color: #9a3412;
  font-size: 13px;
}

.forum-comments__actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

.forum-comments__empty {
  padding: 24px 0;
}

.forum-comment-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.forum-comment-item {
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.7);
  padding: 10px 12px;
}

.forum-comment-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.forum-comment-item__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #64748b;
}

.forum-comment-item__author {
  color: #0f172a;
  font-weight: 600;
}

.forum-comment-item__content {
  margin: 8px 0 0;
  color: #1f2937;
  line-height: 1.7;
  white-space: pre-wrap;
}

.forum-editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.forum-notification-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.forum-notification-item {
  width: 100%;
  text-align: left;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(255, 255, 255, 0.8);
  padding: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.forum-notification-item:hover {
  border-color: rgba(59, 130, 246, 0.45);
}

.forum-notification-item--unread {
  border-color: rgba(251, 191, 36, 0.55);
  background: rgba(255, 251, 235, 0.88);
}

.forum-notification-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #0f172a;
  font-size: 13px;
}

.forum-notification-item__meta {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: #64748b;
  font-size: 12px;
}

@media (max-width: 1200px) {
  .forum-layout {
    grid-template-columns: 1fr;
  }

  .forum-list-card,
  .forum-detail-card {
    min-height: auto;
  }
}
</style>
