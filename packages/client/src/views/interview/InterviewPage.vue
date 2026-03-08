<template>
  <div class="app-page interview-page">
    <div class="app-page-header">
      <n-page-header title="面试管理" subtitle="管理你的面试安排" />
      <n-button type="primary" @click="handleCreateInterview">新建面试</n-button>
    </div>

    <n-card class="app-card">
      <div class="app-toolbar interview-toolbar">
        <n-select
          v-model:value="statusFilter"
          :options="statusFilterOptions"
          placeholder="筛选面试状态"
          clearable
          style="width: 260px"
          @update:value="handleFilterChange"
        />
        <span class="app-chip">共 {{ interviewList.length }} 条</span>
      </div>

      <n-data-table
        v-if="interviewList.length > 0 || loading"
        :columns="columns"
        :data="interviewList"
        :loading="loading"
        :row-key="(row: InterviewItem) => row.id"
      />
      <n-empty
        v-else
        class="app-empty"
        description="暂无面试记录，点击右上角新建第一条"
      />
    </n-card>

    <n-modal
      v-model:show="showInterviewModal"
      preset="card"
      :title="interviewModalTitle"
      style="width: 720px"
      :mask-closable="false"
      @after-leave="resetInterviewModalState"
    >
      <n-form
        ref="interviewFormRef"
        :model="interviewForm"
        :rules="interviewRules"
        label-placement="top"
        require-mark-placement="right-hanging"
      >
        <n-grid :cols="24" :x-gap="16">
          <n-form-item-gi :span="12" label="导师" path="professorId">
            <n-select
              v-model:value="interviewForm.professorId"
              :options="professorOptions"
              :loading="loadingProfessors"
              placeholder="请选择导师"
              clearable
            />
          </n-form-item-gi>

          <n-form-item-gi :span="12" label="面试时间" path="scheduledAt">
            <n-date-picker
              v-model:value="interviewForm.scheduledAt"
              type="datetime"
              clearable
              style="width: 100%"
              placeholder="请选择面试时间"
            />
          </n-form-item-gi>

          <n-form-item-gi :span="12" label="时长（分钟）">
            <n-input-number
              v-model:value="interviewForm.duration"
              :min="1"
              :step="5"
              style="width: 100%"
              placeholder="请输入时长"
            />
          </n-form-item-gi>

          <n-form-item-gi :span="12" label="面试方式" path="method">
            <n-select
              v-model:value="interviewForm.method"
              :options="methodOptions"
              placeholder="请选择面试方式"
            />
          </n-form-item-gi>

          <n-form-item-gi :span="24" :label="locationFieldLabel">
            <n-input
              v-model:value="interviewForm.locationOrMeetingLink"
              :placeholder="locationFieldPlaceholder"
            />
          </n-form-item-gi>

          <n-form-item-gi :span="24" label="备注">
            <n-input
              v-model:value="interviewForm.preparationNotes"
              type="textarea"
              :rows="3"
              placeholder="请输入备注"
            />
          </n-form-item-gi>
        </n-grid>
      </n-form>

      <template #footer>
        <div class="flex justify-end gap-3">
          <n-button @click="showInterviewModal = false">取消</n-button>
          <n-button type="primary" :loading="savingInterview" @click="handleSubmitInterview">
            保存
          </n-button>
        </div>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showLogModal"
      preset="card"
      :title="logModalTitle"
      style="width: 760px"
      :mask-closable="false"
      @after-leave="resetLogModalState"
    >
      <n-spin :show="logLoading">
        <div class="max-h-68 overflow-auto">
          <n-empty v-if="logList.length === 0" description="暂无面试日志" />
          <n-space v-else vertical :size="12">
            <n-card
              v-for="log in logList"
              :key="log.id"
              size="small"
              :title="formatDateTime(log.createdAt)"
            >
              <div class="text-sm">{{ getLogPreview(log.content) }}</div>
            </n-card>
          </n-space>
        </div>

        <n-divider>新增日志</n-divider>

        <n-form ref="logFormRef" :model="logForm" :rules="logRules" label-placement="top">
          <n-form-item label="日志内容" path="content">
            <n-input
              v-model:value="logForm.content"
              type="textarea"
              :rows="3"
              placeholder="请输入面试日志内容"
            />
          </n-form-item>

          <n-form-item label="自评分（1-5星）">
            <n-rate v-model:value="logForm.selfRating" :count="5" clearable />
          </n-form-item>

          <n-form-item label="心情">
            <n-input v-model:value="logForm.mood" placeholder="例如：紧张、放松、满意" />
          </n-form-item>

          <n-form-item label="被问问题">
            <n-input
              v-model:value="logForm.questionsAsked"
              type="textarea"
              :rows="2"
              placeholder="记录面试中被问到的问题"
            />
          </n-form-item>

          <n-form-item label="关键收获">
            <n-input
              v-model:value="logForm.keyTakeaways"
              type="textarea"
              :rows="2"
              placeholder="记录关键收获与改进点"
            />
          </n-form-item>
        </n-form>
      </n-spin>

      <template #footer>
        <div class="flex justify-end gap-3">
          <n-button @click="showLogModal = false">关闭</n-button>
          <n-button type="primary" :loading="logSubmitting" @click="handleCreateLog">
            新增日志
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NDropdown,
  NSpace,
  NTag,
  useDialog,
  useMessage,
  type DataTableColumns,
  type DropdownOption,
  type FormInst,
  type FormRules,
  type SelectOption,
  type TagProps,
} from 'naive-ui'
import { interviewApi, professorApi, type ApiResponse } from '@/api'

type InterviewStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
type InterviewMethod = 'ONLINE' | 'OFFLINE' | 'PHONE'

interface ProfessorOptionItem {
  id: string
  name: string
  university: string
}

interface InterviewItem {
  id: string
  professorId: string
  scheduledAt: string
  duration: number | null
  method: InterviewMethod | string
  location: string | null
  meetingLink: string | null
  status: InterviewStatus | string
  preparationNotes: string | null
  professor?: ProfessorOptionItem
}

interface InterviewLogItem {
  id: string
  interviewId: string
  content: string
  selfRating: number | null
  mood: string | null
  questionsAsked: string | null
  keyTakeaways: string | null
  createdAt: string
}

interface InterviewFormModel {
  professorId: string | null
  scheduledAt: number | null
  duration: number | null
  method: InterviewMethod
  locationOrMeetingLink: string
  preparationNotes: string
}

interface LogFormModel {
  content: string
  selfRating: number | null
  mood: string
  questionsAsked: string
  keyTakeaways: string
}

const router = useRouter()
const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const loadingProfessors = ref(false)
const savingInterview = ref(false)
const logLoading = ref(false)
const logSubmitting = ref(false)

const statusFilter = ref<InterviewStatus | null>(null)
const interviewList = ref<InterviewItem[]>([])
const professorOptions = ref<SelectOption[]>([])
const showInterviewModal = ref(false)
const showLogModal = ref(false)
const editingInterviewId = ref<string | null>(null)
const currentLogInterview = ref<InterviewItem | null>(null)
const logList = ref<InterviewLogItem[]>([])

const interviewFormRef = ref<FormInst | null>(null)
const logFormRef = ref<FormInst | null>(null)

const interviewForm = reactive<InterviewFormModel>({
  professorId: null,
  scheduledAt: null,
  duration: 30,
  method: 'ONLINE',
  locationOrMeetingLink: '',
  preparationNotes: '',
})

const logForm = reactive<LogFormModel>({
  content: '',
  selfRating: null,
  mood: '',
  questionsAsked: '',
  keyTakeaways: '',
})

const statusLabelMap: Record<InterviewStatus, string> = {
  SCHEDULED: '待面试',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

const statusTagTypeMap: Record<InterviewStatus, TagProps['type']> = {
  SCHEDULED: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'error',
}

const methodLabelMap: Record<InterviewMethod, string> = {
  ONLINE: '线上面试',
  OFFLINE: '线下面试',
  PHONE: '电话面试',
}

const statusFilterOptions: SelectOption[] = [
  { label: '待面试（SCHEDULED）', value: 'SCHEDULED' },
  { label: '已完成（COMPLETED）', value: 'COMPLETED' },
  { label: '已取消（CANCELLED）', value: 'CANCELLED' },
]

const statusDropdownOptions: DropdownOption[] = [
  { label: '待面试（SCHEDULED）', key: 'SCHEDULED' },
  { label: '已完成（COMPLETED）', key: 'COMPLETED' },
  { label: '已取消（CANCELLED）', key: 'CANCELLED' },
]

const methodOptions: SelectOption[] = [
  { label: '线上面试', value: 'ONLINE' },
  { label: '线下面试', value: 'OFFLINE' },
  { label: '电话面试', value: 'PHONE' },
]

const interviewRules: FormRules = {
  professorId: [{ required: true, message: '请选择导师', trigger: ['change'] }],
  scheduledAt: [{ required: true, type: 'number', message: '请选择面试时间', trigger: ['change'] }],
  method: [{ required: true, message: '请选择面试方式', trigger: ['change'] }],
}

const logRules: FormRules = {
  content: [{ required: true, message: '请输入日志内容', trigger: ['blur', 'input'] }],
}

const interviewModalTitle = computed(() => (editingInterviewId.value ? '编辑面试' : '新建面试'))

const locationFieldLabel = computed(() => (
  interviewForm.method === 'ONLINE' ? '会议链接' : '地点或说明'
))

const locationFieldPlaceholder = computed(() => (
  interviewForm.method === 'ONLINE' ? '请输入会议链接' : '请输入地点或说明'
))

const logModalTitle = computed(() => {
  if (!currentLogInterview.value) {
    return '面试日志'
  }
  const professorName = currentLogInterview.value.professor?.name ?? '未知导师'
  return `${professorName} - 面试日志`
})

function isInterviewStatus(value: string): value is InterviewStatus {
  return value === 'SCHEDULED' || value === 'COMPLETED' || value === 'CANCELLED'
}

function toNullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getMethodLabel(method: string): string {
  return methodLabelMap[method as InterviewMethod] ?? method
}

function getStatusLabel(status: string): string {
  return statusLabelMap[status as InterviewStatus] ?? status
}

function getStatusType(status: string): TagProps['type'] {
  return statusTagTypeMap[status as InterviewStatus] ?? 'default'
}

function getLogPreview(content: string): string {
  const text = content.trim()
  if (text.length <= 100) {
    return text
  }
  return `${text.slice(0, 100)}...`
}

function resetInterviewForm() {
  interviewForm.professorId = null
  interviewForm.scheduledAt = null
  interviewForm.duration = 30
  interviewForm.method = 'ONLINE'
  interviewForm.locationOrMeetingLink = ''
  interviewForm.preparationNotes = ''
}

function resetLogForm() {
  logForm.content = ''
  logForm.selfRating = null
  logForm.mood = ''
  logForm.questionsAsked = ''
  logForm.keyTakeaways = ''
}

function resetInterviewModalState() {
  editingInterviewId.value = null
  interviewFormRef.value?.restoreValidation()
  resetInterviewForm()
}

function resetLogModalState() {
  currentLogInterview.value = null
  logList.value = []
  logFormRef.value?.restoreValidation()
  resetLogForm()
}

async function fetchInterviews() {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (statusFilter.value) {
      params.status = statusFilter.value
    }
    const response = await interviewApi.list(Object.keys(params).length > 0 ? params : undefined)
    const payload = response.data as ApiResponse<InterviewItem[]>
    interviewList.value = Array.isArray(payload.data) ? payload.data : []
  } catch (error) {
    message.error(getApiErrorMessage(error, '获取面试列表失败'))
  } finally {
    loading.value = false
  }
}

async function fetchProfessorOptions() {
  loadingProfessors.value = true
  try {
    const response = await professorApi.list({
      page: 1,
      pageSize: 1000,
    })

    const payload = response.data as ApiResponse<ProfessorOptionItem[] | { list?: ProfessorOptionItem[] }>
    const rawData = payload.data

    const list = Array.isArray(rawData)
      ? rawData
      : Array.isArray(rawData?.list)
        ? rawData.list
        : []

    professorOptions.value = list.map((item) => ({
      label: `${item.name}（${item.university}）`,
      value: item.id,
    }))
  } catch (error) {
    message.error(getApiErrorMessage(error, '获取导师列表失败'))
  } finally {
    loadingProfessors.value = false
  }
}

function handleFilterChange() {
  void fetchInterviews()
}

async function handleCreateInterview() {
  editingInterviewId.value = null
  resetInterviewForm()
  interviewFormRef.value?.restoreValidation()
  if (professorOptions.value.length === 0) {
    await fetchProfessorOptions()
  }
  showInterviewModal.value = true
}

async function handleEditInterview(row: InterviewItem) {
  editingInterviewId.value = row.id
  if (professorOptions.value.length === 0) {
    await fetchProfessorOptions()
  }

  interviewForm.professorId = row.professorId
  const parsedDate = Date.parse(row.scheduledAt)
  interviewForm.scheduledAt = Number.isNaN(parsedDate) ? null : parsedDate
  interviewForm.duration = row.duration ?? 30
  interviewForm.method = row.method === 'OFFLINE' || row.method === 'PHONE' ? row.method : 'ONLINE'
  interviewForm.locationOrMeetingLink = interviewForm.method === 'ONLINE'
    ? row.meetingLink ?? ''
    : row.location ?? ''
  interviewForm.preparationNotes = row.preparationNotes ?? ''
  interviewFormRef.value?.restoreValidation()
  showInterviewModal.value = true
}

async function handleSubmitInterview() {
  if (savingInterview.value) {
    return
  }

  try {
    await interviewFormRef.value?.validate()
  } catch {
    return
  }

  if (!interviewForm.professorId || !interviewForm.scheduledAt) {
    message.warning('请补全必填信息')
    return
  }

  savingInterview.value = true
  try {
    const locationOrMeetingLink = toNullable(interviewForm.locationOrMeetingLink)
    const payload = {
      professorId: interviewForm.professorId,
      scheduledAt: new Date(interviewForm.scheduledAt).toISOString(),
      duration: interviewForm.duration,
      method: interviewForm.method,
      location: interviewForm.method === 'ONLINE' ? null : locationOrMeetingLink,
      meetingLink: interviewForm.method === 'ONLINE' ? locationOrMeetingLink : null,
      preparationNotes: toNullable(interviewForm.preparationNotes),
    }

    if (editingInterviewId.value) {
      await interviewApi.update(editingInterviewId.value, payload)
      message.success('面试更新成功')
    } else {
      await interviewApi.create(payload)
      message.success('面试创建成功')
    }

    showInterviewModal.value = false
    await fetchInterviews()
  } catch (error) {
    const fallback = editingInterviewId.value ? '更新面试失败' : '创建面试失败'
    message.error(getApiErrorMessage(error, fallback))
  } finally {
    savingInterview.value = false
  }
}

async function handleUpdateStatus(row: InterviewItem, nextStatus: InterviewStatus) {
  if (row.status === nextStatus) {
    return
  }
  try {
    await interviewApi.updateStatus(row.id, nextStatus)
    message.success('状态更新成功')
    await fetchInterviews()
  } catch (error) {
    message.error(getApiErrorMessage(error, '更新状态失败'))
  }
}

function handleDeleteInterview(row: InterviewItem) {
  const professorName = row.professor?.name ?? '该导师'
  dialog.warning({
    title: '确认删除',
    content: `确认删除与 ${professorName} 的面试记录吗？删除后不可恢复。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await interviewApi.remove(row.id)
        message.success('删除成功')
        await fetchInterviews()
      } catch (error) {
        message.error(getApiErrorMessage(error, '删除失败，请稍后重试'))
      }
    },
  })
}

function goToProfessorDetail(professorId: string) {
  void router.push(`/professors/${professorId}`)
}

async function fetchLogs(interviewId: string) {
  logLoading.value = true
  try {
    const response = await interviewApi.getLogs(interviewId)
    const payload = response.data as ApiResponse<InterviewLogItem[]>
    logList.value = Array.isArray(payload.data) ? payload.data : []
  } catch (error) {
    message.error(getApiErrorMessage(error, '获取日志失败'))
  } finally {
    logLoading.value = false
  }
}

async function handleOpenLogModal(row: InterviewItem) {
  currentLogInterview.value = row
  resetLogForm()
  logFormRef.value?.restoreValidation()
  showLogModal.value = true
  await fetchLogs(row.id)
}

async function handleCreateLog() {
  if (!currentLogInterview.value || logSubmitting.value) {
    return
  }

  try {
    await logFormRef.value?.validate()
  } catch {
    return
  }

  logSubmitting.value = true
  try {
    await interviewApi.createLog(currentLogInterview.value.id, {
      content: logForm.content.trim(),
      selfRating: logForm.selfRating,
      mood: toNullable(logForm.mood),
      questionsAsked: toNullable(logForm.questionsAsked),
      keyTakeaways: toNullable(logForm.keyTakeaways),
    })
    message.success('日志新增成功')
    resetLogForm()
    logFormRef.value?.restoreValidation()
    await fetchLogs(currentLogInterview.value.id)
  } catch (error) {
    message.error(getApiErrorMessage(error, '新增日志失败'))
  } finally {
    logSubmitting.value = false
  }
}

const columns: DataTableColumns<InterviewItem> = [
  {
    title: '导师姓名',
    key: 'professorName',
    render: (row) =>
      h(
        NButton,
        {
          text: true,
          type: 'primary',
          onClick: () => goToProfessorDetail(row.professorId),
        },
        {
          default: () => row.professor?.name ?? '-',
        }
      ),
  },
  {
    title: '学校',
    key: 'university',
    render: (row) => row.professor?.university ?? '-',
  },
  {
    title: '面试时间',
    key: 'scheduledAt',
    width: 180,
    render: (row) => formatDateTime(row.scheduledAt),
  },
  {
    title: '面试方式',
    key: 'method',
    width: 120,
    render: (row) => getMethodLabel(row.method),
  },
  {
    title: '状态',
    key: 'status',
    width: 120,
    render: (row) =>
      h(
        NTag,
        {
          type: getStatusType(row.status),
          bordered: false,
        },
        {
          default: () => getStatusLabel(row.status),
        }
      ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 300,
    render: (row) =>
      h(
        NSpace,
        { size: 'small' },
        {
          default: () => [
            h(
              NButton,
              {
                text: true,
                type: 'primary',
                onClick: () => {
                  void handleOpenLogModal(row)
                },
              },
              { default: () => '查看日志' }
            ),
            h(
              NButton,
              {
                text: true,
                onClick: () => {
                  void handleEditInterview(row)
                },
              },
              { default: () => '编辑' }
            ),
            h(
              NDropdown,
              {
                options: statusDropdownOptions,
                onSelect: (key: string | number) => {
                  if (typeof key === 'string' && isInterviewStatus(key)) {
                    void handleUpdateStatus(row, key)
                  }
                },
              },
              {
                default: () =>
                  h(
                    NButton,
                    {
                      text: true,
                    },
                    { default: () => '修改状态' }
                  ),
              }
            ),
            h(
              NButton,
              {
                text: true,
                type: 'error',
                onClick: () => handleDeleteInterview(row),
              },
              { default: () => '删除' }
            ),
          ],
        }
      ),
  },
]

onMounted(() => {
  void fetchInterviews()
  void fetchProfessorOptions()
})
</script>

<style scoped>
.interview-page {
  gap: 14px;
}

.interview-toolbar {
  margin-bottom: 14px;
}
</style>
