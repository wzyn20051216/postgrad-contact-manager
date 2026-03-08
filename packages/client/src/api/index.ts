import { request } from './request'

export interface AuthUser {
  id: string
  email: string
  nickname: string | null
  avatar: string | null
  emailVerified: boolean
  githubUsername: string | null
  createdAt?: string
}

export interface AuthPayload {
  email: string
  password: string
}

export interface RegisterPayload extends AuthPayload {
  nickname?: string
  verificationCode: string
}

export interface RegisterCodePayload {
  email: string
}

export interface ResetPasswordPayload {
  email: string
  verificationCode: string
  newPassword: string
}

export interface RegisterCodeResult {
  expiresInSeconds: number
  cooldownSeconds: number
  deliveryMode: 'smtp' | 'debug'
  debugCode: string | null
}

export interface AuthResult {
  token: string
  user: AuthUser
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

/** 认证相关 API */
export const login = (data: AuthPayload) =>
  request.post<ApiResponse<AuthResult>>('/api/auth/login', data)

export const register = (data: RegisterPayload) =>
  request.post<ApiResponse<AuthResult>>('/api/auth/register', data)

export const sendRegisterCode = (data: RegisterCodePayload) =>
  request.post<ApiResponse<RegisterCodeResult>>('/api/auth/register-code', data)

export const sendResetPasswordCode = (data: RegisterCodePayload) =>
  request.post<ApiResponse<RegisterCodeResult>>('/api/auth/reset-password-code', data)

export const resetPassword = (data: ResetPasswordPayload) =>
  request.post<ApiResponse<null>>('/api/auth/reset-password', data)

export const getMe = () =>
  request.get<ApiResponse<AuthUser>>('/api/auth/me')

export const logout = () =>
  request.post<ApiResponse<null>>('/api/auth/logout')

export const buildGithubAuthorizeUrl = (
  entry: 'login' | 'register' = 'login',
  redirect: string = '/dashboard'
) => {
  const searchParams = new URLSearchParams({ entry, redirect })
  return `/api/auth/github/authorize?${searchParams.toString()}`
}

export const authApi = {
  login,
  register,
  sendRegisterCode,
  sendResetPasswordCode,
  resetPassword,
  getMe,
  logout,
  buildGithubAuthorizeUrl,
  updateProfile: (data: { nickname?: string; avatar?: string }) =>
    request.put('/api/auth/profile', data),
  updatePassword: (data: { oldPassword: string; newPassword: string }) =>
    request.put<ApiResponse<{ token: string }>>('/api/auth/password', data),
  deleteAccount: () =>
    request.delete('/api/auth/account'),
}

/** 导师相关 API */
export const professorApi = {
  list: (params?: Record<string, any>) =>
    request.get('/api/professors', { params }),
  detail: (id: string) =>
    request.get(`/api/professors/${id}`),
  create: (data: Record<string, any>) =>
    request.post('/api/professors', data),
  update: (id: string, data: Record<string, any>) =>
    request.put(`/api/professors/${id}`, data),
  remove: (id: string) =>
    request.delete(`/api/professors/${id}`),
  updateStatus: (id: string, status: string, remark?: string) =>
    request.patch(`/api/professors/${id}/status`, { status, remark }),
}

/** 面试相关 API */
export const interviewApi = {
  list: (params?: Record<string, any>) =>
    request.get('/api/interviews', { params }),
  detail: (id: string) =>
    request.get(`/api/interviews/${id}`),
  create: (data: Record<string, any>) =>
    request.post('/api/interviews', data),
  update: (id: string, data: Record<string, any>) =>
    request.put(`/api/interviews/${id}`, data),
  remove: (id: string) =>
    request.delete(`/api/interviews/${id}`),
  updateStatus: (id: string, status: string) =>
    request.patch(`/api/interviews/${id}/status`, { status }),
  getLogs: (interviewId: string) =>
    request.get(`/api/interviews/${interviewId}/logs`),
  createLog: (interviewId: string, data: Record<string, any>) =>
    request.post(`/api/interviews/${interviewId}/logs`, data),
  updateLog: (interviewId: string, logId: string, data: Record<string, any>) =>
    request.put(`/api/interviews/${interviewId}/logs/${logId}`, data),
  removeLog: (interviewId: string, logId: string) =>
    request.delete(`/api/interviews/${interviewId}/logs/${logId}`),
}

/** 标签相关 API */
export const tagApi = {
  list: () =>
    request.get('/api/tags'),
  create: (data: { name: string; color?: string }) =>
    request.post('/api/tags', data),
  update: (id: string, data: { name?: string; color?: string }) =>
    request.put(`/api/tags/${id}`, data),
  remove: (id: string) =>
    request.delete(`/api/tags/${id}`),
}

/** 文书资料相关 API */
export interface TemplatePayload {
  name: string
  category?: string
  subject?: string
  content?: string
}

export const templateApi = {
  list: (params?: { category?: string }) =>
    request.get('/api/templates', { params }),
  detail: (id: string) =>
    request.get(`/api/templates/${id}`),
  create: (data: TemplatePayload) =>
    request.post('/api/templates', data),
  update: (id: string, data: Partial<TemplatePayload>) =>
    request.put(`/api/templates/${id}`, data),
  importFolder: (data: { folderPath?: string; recursive?: boolean }) =>
    request.post('/api/templates/import-folder', data),
  remove: (id: string) =>
    request.delete(`/api/templates/${id}`),
}

/** 笔记相关 API */
export const noteApi = {
  list: (params?: { professorId?: string }) =>
    request.get('/api/notes', { params }),
  detail: (id: string) =>
    request.get(`/api/notes/${id}`),
  create: (data: Record<string, unknown>) =>
    request.post('/api/notes', data),
  update: (id: string, data: Record<string, unknown>) =>
    request.put(`/api/notes/${id}`, data),
  remove: (id: string) =>
    request.delete(`/api/notes/${id}`),
}

/** 提醒相关 API */
export const reminderApi = {
  list: (params?: { completed?: boolean }) =>
    request.get('/api/reminders', { params }),
  detail: (id: string) =>
    request.get(`/api/reminders/${id}`),
  create: (data: Record<string, unknown>) =>
    request.post('/api/reminders', data),
  update: (id: string, data: Record<string, unknown>) =>
    request.put(`/api/reminders/${id}`, data),
  complete: (id: string) =>
    request.patch(`/api/reminders/${id}/complete`),
  remove: (id: string) =>
    request.delete(`/api/reminders/${id}`),
}

/** 资料链接相关 API */
type ResourceSortType = 'updated' | 'created' | 'visited' | 'popular'

interface ResourceListParams {
  keyword?: string
  category?: string
  pinned?: boolean
  sort?: ResourceSortType
}

interface ResourceMutationPayload {
  title?: string
  url?: string
  category?: string
  description?: string | null
  isPinned?: boolean
}

interface ResourceCategoryMutationPayload {
  fromCategory: string
  toCategory: string
}

type ResourceReportTriggerType = 'MANUAL' | 'SCHEDULED'

export const resourceApi = {
  list: (params?: ResourceListParams) =>
    request.get('/api/resources', {
      params: {
        keyword: params?.keyword,
        category: params?.category,
        pinned: params?.pinned === undefined ? undefined : String(params.pinned),
        sort: params?.sort,
      },
    }),
  categories: () => request.get('/api/resources/categories'),
  detail: (id: string) => request.get(`/api/resources/${id}`),
  create: (data: ResourceMutationPayload) =>
    request.post('/api/resources', data),
  batchCreate: (items: ResourceMutationPayload[]) =>
    request.post('/api/resources/batch', { items }),
  renameCategory: (data: ResourceCategoryMutationPayload) =>
    request.patch('/api/resources/categories/rename', data),
  mergeCategory: (data: ResourceCategoryMutationPayload) =>
    request.patch('/api/resources/categories/merge', data),
  checkAll: (ids?: string[]) =>
    request.post('/api/resources/check', { ids }),
  latestReport: (triggerType?: ResourceReportTriggerType) =>
    request.get('/api/resources/check/report/latest', {
      params: {
        triggerType,
      },
    }),
  update: (id: string, data: ResourceMutationPayload) =>
    request.put(`/api/resources/${id}`, data),
  pin: (id: string, pinned: boolean) => request.patch(`/api/resources/${id}/pin`, { pinned }),
  visit: (id: string) => request.post(`/api/resources/${id}/visit`),
  check: (id: string) => request.post(`/api/resources/${id}/check`),
  remove: (id: string) => request.delete(`/api/resources/${id}`),
}

export interface SchoolSearchSource {
  title: string
  url: string
  snippet: string
  isOfficial: boolean
  summary: string
  mentorHints: string[]
  emails: string[]
  domain: string
  quality: 'high' | 'medium' | 'low'
}

export interface SchoolSearchResult {
  query: string
  focus: string
  totalSources: number
  fetchedAt: string
  fromCache: boolean
  sources: SchoolSearchSource[]
}

export interface SchoolSearchPayload {
  schoolName: string
  focus?: string
  maxSources?: number
}

export const schoolSearchApi = {
  query: (data: SchoolSearchPayload) =>
    request.post<ApiResponse<SchoolSearchResult>>('/api/school-search/query', data),
}

export interface SchoolOfficialSourceItem {
  id: string
  schoolName: string
  siteName: string
  baseUrl: string
  domain: string
  description: string | null
  priority: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface SchoolOfficialSourceStats {
  totalSources: number
  totalSchools: number
  activeSources: number
  inactiveSources: number
}

export interface SchoolOfficialSourceListResult {
  items: SchoolOfficialSourceItem[]
  canManage: boolean
  stats: SchoolOfficialSourceStats
}

export interface SchoolOfficialSourceListParams {
  keyword?: string
  schoolName?: string
  isActive?: boolean
}

export interface SchoolOfficialSourcePayload {
  schoolName: string
  siteName: string
  baseUrl: string
  description?: string | null
  priority?: number
  isActive?: boolean
}

export const schoolSourceApi = {
  list: (params?: SchoolOfficialSourceListParams) =>
    request.get<ApiResponse<SchoolOfficialSourceListResult>>('/api/school-sources', {
      params: {
        keyword: params?.keyword,
        schoolName: params?.schoolName,
        isActive: params?.isActive === undefined ? undefined : String(params.isActive),
      },
    }),
  create: (data: SchoolOfficialSourcePayload) =>
    request.post<ApiResponse<SchoolOfficialSourceItem>>('/api/school-sources', data),
  update: (id: string, data: Partial<SchoolOfficialSourcePayload>) =>
    request.put<ApiResponse<SchoolOfficialSourceItem>>(`/api/school-sources/${id}`, data),
  remove: (id: string) =>
    request.delete<ApiResponse<null>>(`/api/school-sources/${id}`),
}

type ForumPostSort = 'latest' | 'hot' | 'active'

export interface ForumCategory {
  id: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
}

export interface ForumUserSummary {
  id: string
  email: string
  nickname: string | null
  avatar: string | null
  githubUsername: string | null
}

export interface ForumPostItem {
  id: string
  categoryId: string | null
  userId: string
  title: string
  content: string
  isPinned: boolean
  viewCount: number
  commentCount: number
  likeCount: number
  createdAt: string
  updatedAt: string
  likedByMe: boolean
  isAdmin: boolean
  permissions: {
    canEdit: boolean
    canDelete: boolean
    canPin: boolean
  }
  category: Pick<ForumCategory, 'id' | 'name' | 'description' | 'sortOrder'> | null
  user: ForumUserSummary
}

export interface ForumCommentItem {
  id: string
  postId: string
  userId: string
  parentId: string | null
  content: string
  createdAt: string
  updatedAt: string
  canDelete: boolean
  user: ForumUserSummary
  replies: ForumCommentItem[]
}

export interface ForumNotificationItem {
  id: string
  recipientUserId: string
  actorUserId: string | null
  postId: string | null
  commentId: string | null
  type: 'POST_COMMENTED' | 'COMMENT_REPLIED' | 'POST_LIKED' | string
  content: string
  isRead: boolean
  createdAt: string
  readAt: string | null
  actorUser: ForumUserSummary | null
  post: {
    id: string
    title: string
  } | null
  comment: {
    id: string
    content: string
  } | null
}

export interface ForumNotificationListResult {
  items: ForumNotificationItem[]
  unreadCount: number
  isAdmin: boolean
}

interface ForumPostListParams {
  categoryId?: string
  keyword?: string
  sort?: ForumPostSort
  mine?: boolean
}

interface ForumPostPayload {
  title: string
  content: string
  categoryId?: string | null
  isPinned?: boolean
}

export const forumApi = {
  categories: () => request.get<ApiResponse<ForumCategory[]>>('/api/forum/categories'),
  posts: (params?: ForumPostListParams) =>
    request.get<ApiResponse<ForumPostItem[]>>('/api/forum/posts', {
      params: {
        categoryId: params?.categoryId,
        keyword: params?.keyword,
        sort: params?.sort,
        mine: params?.mine === undefined ? undefined : String(params.mine),
      },
    }),
  detail: (id: string) =>
    request.get<ApiResponse<ForumPostItem>>(`/api/forum/posts/${id}`),
  create: (data: ForumPostPayload) =>
    request.post<ApiResponse<ForumPostItem>>('/api/forum/posts', data),
  update: (id: string, data: Partial<ForumPostPayload>) =>
    request.put<ApiResponse<ForumPostItem>>(`/api/forum/posts/${id}`, data),
  remove: (id: string) =>
    request.delete<ApiResponse<null>>(`/api/forum/posts/${id}`),
  comments: (postId: string) =>
    request.get<ApiResponse<ForumCommentItem[]>>(`/api/forum/posts/${postId}/comments`),
  createComment: (postId: string, data: { content: string; parentId?: string | null }) =>
    request.post<ApiResponse<ForumCommentItem>>(`/api/forum/posts/${postId}/comments`, data),
  removeComment: (commentId: string) =>
    request.delete<ApiResponse<null>>(`/api/forum/comments/${commentId}`),
  like: (postId: string) =>
    request.post<ApiResponse<{ liked: boolean; changed: boolean }>>(`/api/forum/posts/${postId}/like`),
  unlike: (postId: string) =>
    request.delete<ApiResponse<{ liked: boolean; changed: boolean }>>(`/api/forum/posts/${postId}/like`),
  notifications: (limit = 30) =>
    request.get<ApiResponse<ForumNotificationListResult>>('/api/forum/notifications', {
      params: { limit },
    }),
  readNotification: (id: string) =>
    request.patch<ApiResponse<null>>(`/api/forum/notifications/${id}/read`),
  readAllNotifications: () =>
    request.post<ApiResponse<{ updatedCount: number }>>('/api/forum/notifications/read-all'),
}

export const dataApi = {
  export: () => request.get('/api/data/export'),
  import: (data: { professors: unknown[] }) => request.post('/api/data/import', data),
  clear: () => request.delete('/api/data/clear'),
}

export { request }
