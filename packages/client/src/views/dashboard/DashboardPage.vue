<template>
  <n-spin :show="loading">
    <div class="dashboard-page">
      <n-card class="welcome-card" :bordered="false">
        <div class="welcome-block">
          <div>
            <p class="welcome-label">Dashboard</p>
            <h2 class="welcome-title">欢迎回来，{{ displayName }}</h2>
            <p class="welcome-subtitle">这里是你的真实数据统计仪表盘</p>
          </div>
          <n-space class="welcome-actions" justify="end">
            <n-button @click="router.push({ name: 'Templates' })">浏览文书资料库</n-button>
            <n-button type="primary" @click="router.push({ name: 'ProfessorCreate' })">添加导师</n-button>
          </n-space>
        </div>
      </n-card>

      <div v-if="isEmptyData" class="empty-guide">
        <n-empty description="还没有数据">
          <template #extra>
            <n-space>
              <n-button type="primary" @click="router.push({ name: 'ProfessorCreate' })">添加第一位导师</n-button>
              <n-button @click="router.push({ name: 'Templates' })">浏览文书资料库</n-button>
            </n-space>
          </template>
        </n-empty>
      </div>

      <n-grid v-else cols="1 s:2 m:4" responsive="screen" :x-gap="16" :y-gap="16">
        <n-gi>
          <n-card size="small" class="stat-card">
            <n-statistic label="导师总数" :value="overview.professorCount" />
          </n-card>
        </n-gi>
        <n-gi>
          <n-card size="small" class="stat-card">
            <n-statistic label="本月新增" :value="overview.thisMonthAdded" />
          </n-card>
        </n-gi>
        <n-gi>
          <n-card size="small" class="stat-card">
            <n-statistic label="面试总数" :value="overview.interviewCount" />
          </n-card>
        </n-gi>
        <n-gi>
          <n-card size="small" class="stat-card">
            <n-statistic label="回复率" :value="replyRate" suffix="%" :precision="1" />
            <div class="stat-extra">
              已回复及后续：{{ repliedAndFollowUpCount }} / {{ totalCountForRate }}
            </div>
          </n-card>
        </n-gi>

        <n-gi span="1 s:2 m:4">
          <n-card title="状态分布" size="small">
            <div class="status-list">
              <div v-for="item in statusRows" :key="item.status" class="status-row">
                <div class="status-row__meta">
                  <span class="status-row__label">{{ item.label }}</span>
                  <span class="status-row__value">{{ item.count }}（{{ item.percentage.toFixed(1) }}%）</span>
                </div>
                <n-progress
                  type="line"
                  :percentage="item.percentage"
                  :show-indicator="false"
                  :height="10"
                  :color="item.color"
                  rail-color="#f3f3f5"
                />
              </div>
            </div>
          </n-card>
        </n-gi>
      </n-grid>
    </div>
  </n-spin>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { request } from '@/api'
import { useAuthStore } from '@/stores/auth'

interface StatsOverview {
  professorCount: number
  interviewCount: number
  thisMonthAdded: number
  statusDistribution: { status: string; count: number }[]
}

type ContactStatus =
  | 'NOT_CONTACTED'
  | 'EMAIL_SENT'
  | 'REPLIED'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEWED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PENDING'

interface StatusMeta {
  status: ContactStatus
  label: string
  color: string
}

const STATUS_META_LIST: StatusMeta[] = [
  { status: 'NOT_CONTACTED', label: '未联系', color: '#8c8c8c' },
  { status: 'EMAIL_SENT', label: '已发邮件', color: '#2080f0' },
  { status: 'REPLIED', label: '已回复', color: '#f0a020' },
  { status: 'INTERVIEW_SCHEDULED', label: '面试已安排', color: '#722ed1' },
  { status: 'INTERVIEWED', label: '已面试', color: '#18a058' },
  { status: 'ACCEPTED', label: '已接受', color: '#52c41a' },
  { status: 'REJECTED', label: '已拒绝', color: '#d03050' },
  { status: 'PENDING', label: '待定', color: '#faad14' },
]

const REPLIED_AND_FOLLOW_UP_SET = new Set<ContactStatus>([
  'REPLIED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWED',
  'ACCEPTED',
  'REJECTED',
  'PENDING',
])

const message = useMessage()
const authStore = useAuthStore()
const router = useRouter()

const loading = ref(false)
const overview = ref<StatsOverview>(createEmptyOverview())

const displayName = computed(() => authStore.user?.nickname || authStore.user?.email || '同学')
const isEmptyData = computed(() => (
  overview.value.professorCount === 0 &&
  overview.value.interviewCount === 0 &&
  overview.value.thisMonthAdded === 0
))

const statusCountMap = computed<Record<ContactStatus, number>>(() => {
  const result = STATUS_META_LIST.reduce((acc, item) => {
    acc[item.status] = 0
    return acc
  }, {} as Record<ContactStatus, number>)

  for (const item of overview.value.statusDistribution) {
    if (item.status in result) {
      const status = item.status as ContactStatus
      result[status] += normalizeCount(item.count)
    }
  }

  return result
})

const totalStatusCount = computed(() => (
  STATUS_META_LIST.reduce((total, item) => total + statusCountMap.value[item.status], 0)
))

const repliedAndFollowUpCount = computed(() => (
  STATUS_META_LIST.reduce((total, item) => {
    if (!REPLIED_AND_FOLLOW_UP_SET.has(item.status)) {
      return total
    }
    return total + statusCountMap.value[item.status]
  }, 0)
))

const totalCountForRate = computed(() => {
  if (overview.value.professorCount > 0) {
    return overview.value.professorCount
  }
  return totalStatusCount.value
})

const replyRate = computed(() => {
  if (totalCountForRate.value <= 0) {
    return 0
  }
  const percentage = (repliedAndFollowUpCount.value / totalCountForRate.value) * 100
  return Number(Math.min(100, percentage).toFixed(1))
})

const statusRows = computed(() => {
  const total = totalStatusCount.value
  return STATUS_META_LIST.map((item) => {
    const count = statusCountMap.value[item.status]
    const percentage = total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0
    return {
      ...item,
      count,
      percentage,
    }
  })
})

/**
 * @description 创建默认统计数据对象
 * @returns 空统计数据
 */
function createEmptyOverview(): StatsOverview {
  return {
    professorCount: 0,
    interviewCount: 0,
    thisMonthAdded: 0,
    statusDistribution: [],
  }
}

/**
 * @description 规范化数量值，确保为非负整数
 * @param value 原始值
 * @returns 非负整数
 */
function normalizeCount(value: unknown): number {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return 0
  }
  return Math.max(0, Math.trunc(num))
}

/**
 * @description 判断值是否为对象
 * @param value 待判断值
 * @returns 是否对象
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * @description 判断对象是否看起来像统计数据
 * @param value 待判断值
 * @returns 是否匹配统计结构
 */
function isStatsOverviewLike(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) {
    return false
  }
  return (
    'professorCount' in value ||
    'interviewCount' in value ||
    'thisMonthAdded' in value ||
    'statusDistribution' in value
  )
}

/**
 * @description 规范化统计数据
 * @param raw 原始数据
 * @returns 标准化后的统计数据
 */
function normalizeOverview(raw: Record<string, unknown>): StatsOverview {
  const distributionRaw = Array.isArray(raw.statusDistribution) ? raw.statusDistribution : []
  const statusDistribution = distributionRaw
    .filter((item): item is { status: string; count: unknown } => (
      isObject(item) && typeof item.status === 'string'
    ))
    .map((item) => ({
      status: item.status,
      count: normalizeCount(item.count),
    }))

  return {
    professorCount: normalizeCount(raw.professorCount),
    interviewCount: normalizeCount(raw.interviewCount),
    thisMonthAdded: normalizeCount(raw.thisMonthAdded),
    statusDistribution,
  }
}

/**
 * @description 从接口响应中提取统计数据
 * @param payload 接口返回数据
 * @returns 统计数据
 */
function extractOverview(payload: unknown): StatsOverview {
  if (isStatsOverviewLike(payload)) {
    return normalizeOverview(payload)
  }

  if (isObject(payload) && isStatsOverviewLike(payload.data)) {
    return normalizeOverview(payload.data)
  }

  return createEmptyOverview()
}

/**
 * @description 获取错误提示文案
 * @param error 异常对象
 * @returns 错误文案
 */
function getErrorMessage(error: unknown): string {
  const fallback = '获取仪表盘数据失败，请稍后重试'
  if (!isObject(error)) {
    return fallback
  }

  const response = isObject(error.response) ? error.response : undefined
  const data = response && isObject(response.data) ? response.data : undefined
  return typeof data?.message === 'string' && data.message.trim().length > 0
    ? data.message
    : fallback
}

/**
 * @description 拉取统计概览数据
 */
async function fetchOverview() {
  loading.value = true
  try {
    const response = await request.get('/api/stats/overview')
    overview.value = extractOverview(response.data)
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchOverview()
})
</script>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.welcome-card {
  border: 0;
  background: linear-gradient(
    138deg,
    rgba(58, 123, 255, 0.9) 0%,
    rgba(72, 155, 255, 0.86) 46%,
    rgba(70, 201, 159, 0.82) 100%
  );
  color: #ffffff;
}

.welcome-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.welcome-label {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  opacity: 0.88;
}

.welcome-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.welcome-subtitle {
  margin: 8px 0 0;
  color: rgba(255, 255, 255, 0.9);
}

.welcome-actions {
  flex-shrink: 0;
}

.empty-guide {
  padding: 60px 0;
  text-align: center;
}

.stat-card {
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  width: 120px;
  height: 120px;
  top: -70px;
  right: -44px;
  border-radius: 50%;
  background: rgba(58, 123, 255, 0.12);
  pointer-events: none;
}

.stat-card :deep(.n-statistic-value) {
  font-size: 28px;
  font-weight: 700;
}

.stat-extra {
  margin-top: 8px;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.status-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-row__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.status-row__label {
  font-size: 14px;
  color: var(--n-text-color-2);
}

.status-row__value {
  font-size: 13px;
  font-weight: 600;
}

@media (max-width: 900px) {
  .welcome-block {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
