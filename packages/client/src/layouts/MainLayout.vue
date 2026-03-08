<template>
  <div class="main-shell">
    <div class="main-shell__halo main-shell__halo--left" />
    <div class="main-shell__halo main-shell__halo--right" />

    <n-layout has-sider class="main-layout">
      <n-layout-sider
        bordered
        collapse-mode="width"
        :collapsed-width="74"
        :width="256"
        :collapsed="collapsed"
        show-trigger
        class="main-layout__sider"
        @collapse="collapsed = true"
        @expand="collapsed = false"
      >
        <div class="brand-panel">
          <div class="brand-panel__logo">
            <img
              class="brand-panel__logo-image"
              src="/app-icon.png"
              alt="套磁管理系统 Logo"
            >
          </div>
          <div v-if="!collapsed" class="brand-panel__text">
            <div class="brand-panel__title">套磁管理系统</div>
            <div class="brand-panel__subtitle">Postgrad Contact Manager</div>
          </div>
        </div>

        <n-menu
          class="main-menu"
          :collapsed="collapsed"
          :collapsed-width="74"
          :collapsed-icon-size="20"
          :options="menuOptions"
          :value="activeKey"
          @update:value="handleMenuClick"
        />

        <div class="sider-footer">
          <n-tag :bordered="false" round size="small" type="info">
            v1.0.0
          </n-tag>
          <span v-if="!collapsed" class="sider-footer__text">稳定运行中</span>
        </div>
      </n-layout-sider>

      <n-layout class="main-layout__content-area">
        <n-layout-header class="main-layout__header">
          <div class="header-info">
            <p class="header-info__prefix">研究生套磁工作台</p>
            <h2 class="header-info__title">{{ currentTitle }}</h2>
            <p class="header-info__subtitle">{{ currentSubtitle }}</p>
          </div>

          <div class="header-actions">
            <div class="header-date">{{ todayLabel }}</div>
            <div class="user-chip">
              <div class="user-chip__avatar">{{ userInitial }}</div>
              <div class="user-chip__meta">
                <span class="user-chip__name">{{ displayName }}</span>
                <span class="user-chip__email">{{ authStore.user?.email }}</span>
              </div>
            </div>
            <n-popconfirm @positive-click="handleLogout">
              <template #trigger>
                <n-button secondary type="default" size="small">
                  退出登录
                </n-button>
              </template>
              确认退出登录吗？
            </n-popconfirm>
          </div>
        </n-layout-header>

        <n-layout-content class="main-layout__content">
          <div :key="route.fullPath" class="main-layout__content-inner route-fade-up">
            <router-view />
          </div>
        </n-layout-content>
      </n-layout>
    </n-layout>
  </div>
</template>

<script setup lang="ts">
import { computed, h, ref, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NIcon, NPopconfirm } from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import {
  AppsOutline,
  ArchiveOutline,
  CalendarOutline,
  ChatbubblesOutline,
  DocumentTextOutline,
  GlobeOutline,
  GridOutline,
  LinkOutline,
  MailOutline,
  NotificationsOutline,
  PeopleOutline,
  PricetagOutline,
  SearchOutline,
  SettingsOutline,
} from '@vicons/ionicons5'
import { useAuthStore } from '@/stores/auth'

interface PageMeta {
  title: string
  subtitle: string
}

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const collapsed = ref(false)

const routeMenuMap: Record<string, string> = {
  ProfessorCreate: 'Professors',
  ProfessorDetail: 'Professors',
  ProfessorEdit: 'Professors',
  NoteCreate: 'Notes',
  NoteEdit: 'Notes',
}

const pageMetaMap: Record<string, PageMeta> = {
  Dashboard: {
    title: '数据总览',
    subtitle: '查看导师联系进展与本周关键指标',
  },
  Professors: {
    title: '导师管理',
    subtitle: '集中管理导师信息、联系状态与跟进动作',
  },
  ProfessorCreate: {
    title: '新建导师',
    subtitle: '录入导师资料并建立后续跟进节点',
  },
  ProfessorDetail: {
    title: '导师详情',
    subtitle: '查看基础信息、历史记录与当前联系状态',
  },
  ProfessorEdit: {
    title: '编辑导师',
    subtitle: '更新导师资料，保持数据持续准确',
  },
  Kanban: {
    title: '联系看板',
    subtitle: '拖拽更新状态，快速推进套磁节奏',
  },
  Interviews: {
    title: '面试管理',
    subtitle: '统一安排时间、记录反馈与结果沉淀',
  },
  Templates: {
    title: '文书资料库',
    subtitle: '集中管理简历、成绩单与个人陈述等关键文书',
  },
  Tags: {
    title: '标签管理',
    subtitle: '通过标签快速筛选不同导师分组',
  },
  Reminders: {
    title: '提醒事项',
    subtitle: '按优先级处理待办，避免遗漏关键动作',
  },
  Notes: {
    title: '笔记管理',
    subtitle: '沉淀访谈记录、导师偏好与复盘要点',
  },
  NoteCreate: {
    title: '新建笔记',
    subtitle: '进入沉浸式写作页，记录沟通要点与复盘结论',
  },
  NoteEdit: {
    title: '继续写笔记',
    subtitle: '像写文章一样整理思路，持续补充关键细节',
  },
  Resources: {
    title: '资料专区',
    subtitle: '集中管理你收藏的资料链接与学习入口',
  },
  SchoolSearch: {
    title: '院校信息检索',
    subtitle: '按学校名称快速获取导师与招生线索，并附官网来源链接',
  },
  SchoolSources: {
    title: '院校官方源库',
    subtitle: '维护学校官网、研究生院与招生入口，让检索结果更稳更准',
  },
  Forum: {
    title: '论坛交流区',
    subtitle: '围绕保研流程交流经验、提问答疑并共享资料',
  },
  Settings: {
    title: '系统设置',
    subtitle: '维护账号信息、安全项与偏好配置',
  },
  Data: {
    title: '数据管理',
    subtitle: '安全导入导出，保障数据可迁移与可恢复',
  },
}

const activeKey = computed(() => (
  routeMenuMap[route.name as string] || (route.name as string)
))

const currentPageMeta = computed<PageMeta>(() => (
  pageMetaMap[route.name as string] || {
    title: '套磁管理系统',
    subtitle: '让每一次沟通都可追踪、可复盘、可优化',
  }
))

const currentTitle = computed(() => currentPageMeta.value.title)
const currentSubtitle = computed(() => currentPageMeta.value.subtitle)

const displayName = computed(() => (
  authStore.user?.nickname || authStore.user?.email || '同学'
))

const userInitial = computed(() => getNameInitial(displayName.value))

const todayLabel = computed(() => (
  new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date())
))

function renderIcon(icon: Component) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

/**
 * @description 生成头像展示字符
 * @param value 用户展示名称
 * @returns 头像字符
 */
function getNameInitial(value: string): string {
  const text = value.trim()
  if (!text) {
    return '套'
  }
  return text.charAt(0).toUpperCase()
}

const menuOptions: MenuOption[] = [
  { label: '仪表盘', key: 'Dashboard', icon: renderIcon(GridOutline) },
  { type: 'divider', key: 'divider-main' },
  {
    label: '导师管理',
    key: 'professor-group',
    type: 'group',
    children: [
      { label: '导师列表', key: 'Professors', icon: renderIcon(PeopleOutline) },
      { label: '看板视图', key: 'Kanban', icon: renderIcon(AppsOutline) },
      { label: '面试管理', key: 'Interviews', icon: renderIcon(CalendarOutline) },
    ],
  },
  { type: 'divider', key: 'divider-tool' },
  {
    label: '辅助工具',
    key: 'tool-group',
    type: 'group',
    children: [
      { label: '文书资料库', key: 'Templates', icon: renderIcon(MailOutline) },
      { label: '标签管理', key: 'Tags', icon: renderIcon(PricetagOutline) },
      { label: '提醒事项', key: 'Reminders', icon: renderIcon(NotificationsOutline) },
      { label: '笔记管理', key: 'Notes', icon: renderIcon(DocumentTextOutline) },
      { label: '资料专区', key: 'Resources', icon: renderIcon(LinkOutline) },
      { label: '院校信息检索', key: 'SchoolSearch', icon: renderIcon(SearchOutline) },
      { label: '院校官方源库', key: 'SchoolSources', icon: renderIcon(GlobeOutline) },
      { label: '论坛交流区', key: 'Forum', icon: renderIcon(ChatbubblesOutline) },
    ],
  },
  { type: 'divider', key: 'divider-system' },
  {
    label: '系统',
    key: 'system-group',
    type: 'group',
    children: [
      { label: '数据管理', key: 'Data', icon: renderIcon(ArchiveOutline) },
      { label: '系统设置', key: 'Settings', icon: renderIcon(SettingsOutline) },
    ],
  },
]

const navigableMenuKeys = new Set([
  'Dashboard',
  'Professors',
  'Kanban',
  'Interviews',
  'Templates',
  'Tags',
  'Reminders',
  'Notes',
  'Resources',
  'SchoolSearch',
  'SchoolSources',
  'Forum',
  'Data',
  'Settings',
])

function handleMenuClick(key: string) {
  if (!navigableMenuKeys.has(key)) {
    return
  }
  if (key === activeKey.value) {
    return
  }
  void router.push({ name: key })
}

async function handleLogout() {
  await authStore.logout()
  await router.push({ name: 'Login' })
}
</script>

<style scoped>
.main-shell {
  position: relative;
  min-height: 100vh;
  padding: 14px;
}

.main-shell__halo {
  position: absolute;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  filter: blur(54px);
  pointer-events: none;
  z-index: 0;
}

.main-shell__halo--left {
  top: -120px;
  left: -80px;
  background: rgba(78, 132, 255, 0.3);
}

.main-shell__halo--right {
  right: -100px;
  bottom: -180px;
  background: rgba(75, 216, 173, 0.28);
}

.main-layout {
  position: relative;
  z-index: 1;
  height: calc(100vh - 28px);
  border-radius: 24px;
  overflow: hidden;
  background: transparent;
}

.main-layout__sider {
  border-right: 1px solid rgba(148, 163, 184, 0.24);
  box-shadow: 10px 0 38px rgba(15, 23, 42, 0.06);
}

:deep(.main-layout__sider .n-layout-toggle-button) {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.brand-panel {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 18px 14px;
}

.brand-panel__logo {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  overflow: hidden;
  flex-shrink: 0;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.22);
  box-shadow: 0 10px 22px rgba(58, 123, 255, 0.24);
}

.brand-panel__logo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.brand-panel__text {
  min-width: 0;
}

.brand-panel__title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
}

.brand-panel__subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
}

.main-menu {
  padding: 0 12px;
}

:deep(.main-menu .n-menu-item-content-header),
:deep(.main-menu .n-menu-item-content__arrow) {
  font-weight: 600;
}

:deep(.main-menu .n-menu-item-group-title) {
  padding-left: 8px;
  color: #64748b;
}

.sider-footer {
  margin-top: auto;
  padding: 14px 16px 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.sider-footer__text {
  font-size: 12px;
  color: #64748b;
}

.main-layout__content-area {
  background: transparent;
}

.main-layout__header {
  height: 88px;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(148, 163, 184, 0.22);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.header-info {
  min-width: 0;
}

.header-info__prefix {
  margin: 0 0 4px;
  font-size: 12px;
  color: #3a7bff;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.header-info__title {
  margin: 0;
  font-size: 24px;
  line-height: 1.2;
  color: #0f172a;
}

.header-info__subtitle {
  margin: 3px 0 0;
  font-size: 13px;
  color: #64748b;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-date {
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
  color: #334155;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 8px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.74);
}

.user-chip__avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #4084ff 0%, #4fd0a4 100%);
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.user-chip__meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-chip__name {
  max-width: 140px;
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-chip__email {
  max-width: 160px;
  font-size: 11px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.main-layout__content {
  background: transparent;
  padding: 20px 24px 24px;
}

.main-layout__content-inner {
  min-height: calc(100vh - 168px);
}

@media (max-width: 900px) {
  .main-shell {
    padding: 0;
  }

  .main-layout {
    height: 100vh;
    border-radius: 0;
  }

  .main-layout__header {
    height: auto;
    padding: 14px 16px;
    align-items: flex-start;
    gap: 12px;
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .header-date {
    display: none;
  }

  .main-layout__content {
    padding: 14px 16px 18px;
  }
}
</style>
