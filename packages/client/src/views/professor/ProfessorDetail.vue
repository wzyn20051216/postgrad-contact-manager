<template>
  <div class="app-page professor-detail-page">
    <n-card class="app-card detail-hero-card">
      <n-page-header @back="handleBack">
        <template #title>
          {{ professor?.name || '导师详情' }}
        </template>
        <template #subtitle>
          <div class="detail-subtitle">
            <span>{{ professorSubtitle }}</span>
            <n-tag :type="currentStatusConfig.type" size="small">
              {{ currentStatusConfig.label }}
            </n-tag>
          </div>
        </template>
        <template #extra>
          <div class="flex items-center gap-2">
            <n-button @click="handleEdit">
              编辑
            </n-button>
            <n-button type="primary" @click="openStatusModal">
              更改状态
            </n-button>
          </div>
        </template>
      </n-page-header>
    </n-card>

    <n-spin :show="loading">
      <template v-if="professor">
        <n-card title="基础信息" class="app-card">
          <n-descriptions :column="2" bordered label-placement="left">
            <n-descriptions-item label="研究方向">
              {{ displayValue(professor.researchArea) }}
            </n-descriptions-item>
            <n-descriptions-item label="邮箱">
              {{ displayValue(professor.email) }}
            </n-descriptions-item>
            <n-descriptions-item label="电话">
              {{ displayValue(professor.phone) }}
            </n-descriptions-item>
            <n-descriptions-item label="主页">
              <a v-if="professor.homepage" :href="professor.homepage" target="_blank" rel="noopener noreferrer">
                {{ professor.homepage }}
              </a>
              <span v-else>-</span>
            </n-descriptions-item>
            <n-descriptions-item label="微信">
              {{ displayValue(professor.wechat) }}
            </n-descriptions-item>
            <n-descriptions-item label="院校评级">
              {{ displayValue(professor.schoolRating) }}
            </n-descriptions-item>
            <n-descriptions-item label="是否招生">
              {{ professor.acceptingStudents ? '是' : '否' }}
            </n-descriptions-item>
            <n-descriptions-item label="招生名额">
              {{ displayValue(professor.enrollmentQuota) }}
            </n-descriptions-item>
            <n-descriptions-item label="信息来源">
              {{ displayValue(professor.source) }}
            </n-descriptions-item>
          </n-descriptions>
        </n-card>

        <n-card title="风评卡片" class="app-card">
          <div class="reputation-panel">
            <div class="reputation-panel__score">
              <n-rate :value="reputationScore" readonly />
              <span>{{ reputationScore }} / 5</span>
            </div>
            <div>
              {{ displayValue(professor.reputationComment) }}
            </div>
          </div>
        </n-card>

        <n-card class="app-card">
          <n-tabs type="line" animated>
            <n-tab-pane name="interview-records" tab="面试记录">
              <n-empty description="暂无面试记录" />
            </n-tab-pane>
            <n-tab-pane name="communication-records" tab="沟通记录">
              <n-empty description="暂无沟通记录" />
            </n-tab-pane>
          </n-tabs>
        </n-card>

        <n-card title="状态变更历史" class="app-card">
          <n-timeline v-if="statusLogs.length > 0">
            <n-timeline-item
              v-for="item in statusLogs"
              :key="item.id"
              :time="formatDateTime(item.createdAt)"
              :title="`${getStatusConfig(item.fromStatus).label} → ${getStatusConfig(item.toStatus).label}`"
              :content="item.remark || '无备注'"
            />
          </n-timeline>
          <n-empty v-else description="暂无状态变更记录" />
        </n-card>
      </template>
      <n-card v-else class="app-card">
        <n-empty description="暂无导师信息" />
      </n-card>
    </n-spin>
  </div>

  <n-modal
    v-model:show="statusModalVisible"
    preset="card"
    title="更改联系状态"
    style="width: 520px"
  >
    <div class="space-y-4">
      <div>
        <div class="mb-2">
          新状态
        </div>
        <n-select
          v-model:value="statusForm.status"
          :options="statusOptions"
          placeholder="请选择联系状态"
        />
      </div>
      <div>
        <div class="mb-2">
          备注
        </div>
        <n-input
          v-model:value="statusForm.remark"
          type="textarea"
          placeholder="请输入备注"
          :autosize="{ minRows: 3, maxRows: 6 }"
        />
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <n-button @click="statusModalVisible = false">
          取消
        </n-button>
        <n-button type="primary" :loading="statusSubmitting" @click="submitStatusChange">
          确认
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage, type SelectOption } from 'naive-ui'
import { professorApi } from '@/api'

type TagType = 'default' | 'success' | 'info' | 'warning' | 'error'

type ContactStatus =
  | 'NOT_CONTACTED'
  | 'EMAIL_SENT'
  | 'REPLIED'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEWED'
  | 'ACCEPTED'
  | 'REJECTED'

interface StatusLogItem {
  id: string
  fromStatus: string
  toStatus: string
  remark: string | null
  createdAt: string
}

interface ProfessorDetail {
  id: string
  name: string
  university: string
  college: string
  title: string
  researchArea: string
  email: string | null
  phone: string | null
  homepage: string | null
  wechat: string | null
  schoolRating: string | null
  reputationScore: number | null
  reputationComment: string | null
  contactStatus: string
  source: string | null
  enrollmentQuota: number | null
  acceptingStudents: boolean
  statusLogs: StatusLogItem[]
}

const STATUS_CONFIG: Record<ContactStatus, { label: string; type: TagType }> = {
  NOT_CONTACTED: { label: '未联系', type: 'default' },
  EMAIL_SENT: { label: '已发邮件', type: 'info' },
  REPLIED: { label: '已回复', type: 'success' },
  INTERVIEW_SCHEDULED: { label: '已约面试', type: 'warning' },
  INTERVIEWED: { label: '已面试', type: 'warning' },
  ACCEPTED: { label: '已录取', type: 'success' },
  REJECTED: { label: '已拒绝', type: 'error' },
}

const route = useRoute()
const router = useRouter()
const message = useMessage()

const loading = ref(false)
const statusSubmitting = ref(false)
const statusModalVisible = ref(false)
const professor = ref<ProfessorDetail | null>(null)
const statusForm = reactive({
  status: '' as ContactStatus | '',
  remark: '',
})

const statusOptions: SelectOption[] = (Object.keys(STATUS_CONFIG) as ContactStatus[]).map((status) => ({
  label: STATUS_CONFIG[status].label,
  value: status,
}))

const professorId = computed(() => {
  const rawId = route.params.id
  if (Array.isArray(rawId)) {
    return rawId[0] ?? ''
  }
  return typeof rawId === 'string' ? rawId : ''
})

const professorSubtitle = computed(() => {
  if (!professor.value) {
    return '-'
  }

  return [professor.value.university, professor.value.college, professor.value.title]
    .filter((item) => Boolean(item))
    .join(' / ')
})

const currentStatusConfig = computed(() => getStatusConfig(professor.value?.contactStatus))

const reputationScore = computed(() => {
  const score = professor.value?.reputationScore ?? 0
  return Math.max(0, Math.min(5, score))
})

const statusLogs = computed(() => professor.value?.statusLogs ?? [])

watch(
  professorId,
  () => {
    void loadProfessorDetail()
  },
  { immediate: true },
)

function handleBack() {
  router.back()
}

function handleEdit() {
  router.push({ path: '/professors/' + professorId.value + '/edit' })
}

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return String(value)
}

function getStatusConfig(status: string | undefined) {
  if (!status) {
    return { label: '-', type: 'default' as TagType }
  }

  if (status in STATUS_CONFIG) {
    return STATUS_CONFIG[status as ContactStatus]
  }

  return { label: status, type: 'default' as TagType }
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleString('zh-CN', { hour12: false })
}

function openStatusModal() {
  if (!professor.value) {
    message.warning('请先加载导师信息')
    return
  }
  statusForm.status = (professor.value.contactStatus as ContactStatus) ?? 'NOT_CONTACTED'
  statusForm.remark = ''
  statusModalVisible.value = true
}

async function loadProfessorDetail() {
  if (!professorId.value) {
    professor.value = null
    return
  }

  loading.value = true
  try {
    const response = await professorApi.detail(professorId.value)
    professor.value = (response.data?.data ?? null) as ProfessorDetail | null
  } catch {
    professor.value = null
    message.error('加载导师详情失败')
  } finally {
    loading.value = false
  }
}

async function submitStatusChange() {
  if (!professorId.value) {
    message.error('导师 ID 无效')
    return
  }

  if (!statusForm.status) {
    message.warning('请选择新状态')
    return
  }

  statusSubmitting.value = true
  try {
    const remark = statusForm.remark.trim()
    await professorApi.updateStatus(professorId.value, statusForm.status, remark || undefined)
    message.success('状态更新成功')
    statusModalVisible.value = false
    await loadProfessorDetail()
  } catch {
    message.error('状态更新失败')
  } finally {
    statusSubmitting.value = false
  }
}
</script>

<style scoped>
.professor-detail-page {
  gap: 16px;
}

.detail-hero-card {
  border: 0;
}

.detail-subtitle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reputation-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reputation-panel__score {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
