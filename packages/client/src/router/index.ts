import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/LoginPage.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/auth/RegisterPage.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/reset-password',
    name: 'ResetPassword',
    component: () => import('@/views/auth/ResetPasswordPage.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/dashboard',
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/DashboardPage.vue'),
      },
      {
        path: 'professors',
        name: 'Professors',
        component: () => import('@/views/professor/ProfessorList.vue'),
      },
      {
        path: 'professors/new',
        name: 'ProfessorCreate',
        component: () => import('@/views/professor/ProfessorForm.vue'),
      },
      {
        path: 'professors/:id',
        name: 'ProfessorDetail',
        component: () => import('@/views/professor/ProfessorDetail.vue'),
      },
      {
        path: 'professors/:id/edit',
        name: 'ProfessorEdit',
        component: () => import('@/views/professor/ProfessorForm.vue'),
      },
      {
        path: 'kanban',
        name: 'Kanban',
        component: () => import('@/views/kanban/KanbanPage.vue'),
      },
      {
        path: 'interviews',
        name: 'Interviews',
        component: () => import('@/views/interview/InterviewPage.vue'),
      },
      {
        path: 'templates',
        name: 'Templates',
        component: () => import('@/views/template/TemplatePage.vue'),
      },
      {
        path: 'tags',
        name: 'Tags',
        component: () => import('@/views/tag/TagPage.vue'),
      },
      {
        path: 'reminders',
        name: 'Reminders',
        component: () => import('@/views/reminder/ReminderPage.vue'),
      },
      {
        path: 'notes',
        name: 'Notes',
        component: () => import('@/views/note/NotePage.vue'),
      },
      {
        path: 'notes/new',
        name: 'NoteCreate',
        component: () => import('@/views/note/NoteEditorPage.vue'),
      },
      {
        path: 'notes/:id/edit',
        name: 'NoteEdit',
        component: () => import('@/views/note/NoteEditorPage.vue'),
      },
      {
        path: 'resources',
        name: 'Resources',
        component: () => import('@/views/resource/ResourcePage.vue'),
      },
      {
        path: 'school-search',
        name: 'SchoolSearch',
        component: () => import('@/views/school-search/SchoolSearchPage.vue'),
      },
      {
        path: 'school-sources',
        name: 'SchoolSources',
        component: () => import('@/views/school-search/SchoolSourcePage.vue'),
      },
      {
        path: 'forum',
        name: 'Forum',
        component: () => import('@/views/forum/ForumPage.vue'),
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/settings/SettingsPage.vue'),
      },
      {
        path: 'data',
        name: 'Data',
        component: () => import('@/views/data/DataPage.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/** @description 路由守卫，先完成登录态初始化再决定跳转 */
router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  await authStore.initAuth()

  if (to.meta.requiresAuth !== false && !authStore.isLoggedIn) {
    return { name: 'Login' }
  }

  if ((to.name === 'Login' || to.name === 'Register' || to.name === 'ResetPassword') && authStore.isLoggedIn) {
    return { name: 'Dashboard' }
  }

  return true
})

export default router
