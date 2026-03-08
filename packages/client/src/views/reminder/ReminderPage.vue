<template>
  <div class="app-page reminder-page">
    <div class="app-page-header">
      <n-page-header title="提醒管理" subtitle="集中管理待办提醒与完成记录" />
      <n-button type="primary" @click="openCreateModal">新建提醒</n-button>
    </div>

    <n-card class="app-card">
      <n-tabs v-model:value="activeTab" type="line" animated @update:value="handleTabChange">
        <n-tab-pane name="pending" tab="待完成" />
        <n-tab-pane name="done" tab="已完成" />
      </n-tabs>

      <n-spin :show="loading">
        <n-empty
          v-if="!loading && sortedReminders.length === 0"
          :description="activeTab === 'pending' ? '暂无待完成提醒' : '暂无已完成提醒'"
          class="app-empty"
        />
        <n-list v-else bordered class="reminder-list">
          <n-list-item v-for="item in sortedReminders" :key="item.id">
            <div class="flex w-full items-start justify-between gap-4">
              <div class="min-w-0 flex-1">
                <div class="text-base font-medium">{{ item.title }}</div>
                <div
                  v-if="item.professor"
                  class="mt-1 text-sm text-[var(--n-text-color-2)]"
                >
                  关联导师：{{ item.professor.name }}（{{ item.professor.university }}）
                </div>
                <div
                  v-else-if="item.professorId"
                  class="mt-1 text-sm text-[var(--n-text-color-2)]"
                >
                  关联导师 ID：{{ item.professorId }}
                </div>
                <div
                  v-if="item.description"
                  class="mt-1 text-sm text-[var(--n-text-color-3)]"
                >
                  {{ item.description }}
                </div>
              </div>

              <div class="flex flex-col items-end gap-2">
                <n-space size="small" align="center">
                  <n-tag size="small" :type="getReminderTagType(item.type)">
                    {{ getReminderTypeLabel(item.type) }}
                  </n-tag>
                  <span
                    :class="[
                      'text-sm',
                      isOverdue(item) ? 'text-[#d03050]' : 'text-[var(--n-text-color-2)]',
                    ]"
                  >
                    {{ formatDateTime(item.remindAt) }}
                  </span>
                </n-space>

                <n-space size="small" align="center">
                  <n-button size="small" @click="openEditModal(item)">编辑</n-button>

                  <n-popconfirm
                    v-if="!item.isCompleted"
                    @positive-click="() => handleComplete(item.id)"
                  >
                    <template #trigger>
                      <n-button size="small" type="success">标记完成</n-button>
                    </template>
                    确认将该提醒标记为已完成吗？
                  </n-popconfirm>
                  <span v-else class="text-xs text-[var(--n-text-color-3)]">已完成</span>

                  <n-popconfirm @positive-click="() => handleDelete(item.id)">
                    <template #trigger>
                      <n-button size="small" type="error">删除</n-button>
                    </template>
                    确认删除该提醒吗？删除后不可恢复。
                  </n-popconfirm>
                </n-space>
              </div>
            </div>
          </n-list-item>
        </n-list>
      </n-spin>
    </n-card>

    <n-modal
      v-model:show="showModal"
      preset="dialog"
      :title="modalTitle"
      style="width: 640px"
      :mask-closable="false"
      @after-leave="resetModalState"
    >
      <n-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-placement="left"
        label-width="90"
        class="mt-4"
      >
        <n-form-item label="标题" path="title">
          <n-input v-model:value="form.title" placeholder="请输入提醒标题" maxlength="100" clearable />
        </n-form-item>

        <n-form-item label="类型" path="type">
          <n-select v-model:value="form.type" :options="REMINDER_TYPES" placeholder="请选择提醒类型" />
        </n-form-item>

        <n-form-item label="提醒时间" path="remindAt">
          <n-date-picker
            v-model:value="form.remindAt"
            type="datetime"
            clearable
            style="width: 100%"
            placeholder="请选择提醒时间"
          />
        </n-form-item>

        <n-form-item label="描述">
          <n-input
            v-model:value="form.description"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-count
            placeholder="可选，补充提醒说明"
          />
        </n-form-item>

        <n-form-item label="关联导师">
          <n-select
            v-model:value="form.professorId"
            :options="professorOptions"
            clearable
            filterable
            placeholder="可选：搜索并选择关联导师"
          />
        </n-form-item>
      </n-form>

      <template #action>
        <n-space justify="end">
          <n-button @click="showModal = false">取消</n-button>
          <n-button type="primary" :loading="submitting" @click="handleSubmit">
            保存
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useMessage, type FormInst, type FormRules, type TagProps } from 'naive-ui'
import { reminderApi, professorApi } from '@/api'

/**
 * @description 提醒类型选项常量。
 */
const REMINDER_TYPES = [
  { value: 'FOLLOW_UP', label: '跟进' },
  { value: 'INTERVIEW', label: '面试' },
  { value: 'DEADLINE', label: '截止日期' },
  { value: 'OTHER', label: '其他' },
] as const

type ReminderTab = 'pending' | 'done'

interface Reminder {
  id: string
  title: string
  description: string | null
  remindAt: string
  type: string
  isCompleted: boolean
  professorId: string | null
  professor: { id: string; name: string; university: string } | null
  createdAt: string
}

interface ReminderFormModel {
  title: string
  type: string
  remindAt: number | null
  description: string
  professorId: string
}

const DEFAULT_REMINDER_TYPE = 'FOLLOW_UP'

const message = useMessage()

const loading = ref(false)
const submitting = ref(false)
const showModal = ref(false)
const activeTab = ref<ReminderTab>('pending')
const editingId = ref<string | null>(null)
const list = ref<Reminder[]>([])
const professorOptions = ref<Array<{ label: string, value: string }>>([])
const formRef = ref<FormInst | null>(null)

const form = ref<ReminderFormModel>({
  title: '',
  type: DEFAULT_REMINDER_TYPE,
  remindAt: null,
  description: '',
  professorId: '',
})

const rules: FormRules = {
  title: [{ required: true, message: '请输入提醒标题', trigger: ['blur', 'input'] }],
  type: [{ required: true, message: '请选择提醒类型', trigger: ['change', 'blur'] }],
  remindAt: [{ required: true, type: 'number', message: '请选择提醒时间', trigger: 'change' }],
}

const isCompletedTab = computed(() => activeTab.value === 'done')

const modalTitle = computed(() => (editingId.value ? '编辑提醒' : '新建提醒'))

const sortedReminders = computed(() => (
  [...list.value].sort((left, right) => {
    const leftTime = parseRemindTimestamp(left.remindAt)
    const rightTime = parseRemindTimestamp(right.remindAt)
    if (isCompletedTab.value) {
      return rightTime - leftTime
    }
    return leftTime - rightTime
  })
))

/**
 * @description 将提醒时间字符串转换为毫秒时间戳，非法值返回 0。
 * @param remindAt ISO 格式提醒时间
 * @returns 毫秒时间戳
 */
function parseRemindTimestamp(remindAt: string): number {
  const timestamp = Date.parse(remindAt)
  return Number.isFinite(timestamp) ? timestamp : 0
}

/**
 * @description 提取后端错误信息。
 * @param error 异常对象
 * @param fallback 默认提示文案
 * @returns 错误文案
 */
function getErrorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback
}

/**
 * @description 从响应体中提取提醒列表。
 * @param payload 接口响应数据
 * @returns 提醒数组
 */
function extractReminderList(payload: unknown): Reminder[] {
  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: Reminder[] }).data
  }
  return []
}

/**
 * @description 获取提醒类型显示文本。
 * @param type 提醒类型值
 * @returns 类型标签
 */
function getReminderTypeLabel(type: string): string {
  return REMINDER_TYPES.find(item => item.value === type)?.label ?? type
}

/**
 * @description 获取提醒类型的标签颜色。
 * @param type 提醒类型值
 * @returns 标签类型
 */
function getReminderTagType(type: string): TagProps['type'] {
  const tagTypeMap: Record<string, TagProps['type']> = {
    FOLLOW_UP: 'warning',
    INTERVIEW: 'info',
    DEADLINE: 'error',
    OTHER: 'default',
  }
  return tagTypeMap[type] ?? 'default'
}

/**
 * @description 格式化提醒时间文本。
 * @param value ISO 格式提醒时间
 * @returns 可读时间文本
 */
function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '时间格式错误'
  }
  return date.toLocaleString('zh-CN', { hour12: false })
}

/**
 * @description 判断提醒是否逾期。
 * @param item 提醒项
 * @returns 是否逾期
 */
function isOverdue(item: Reminder): boolean {
  if (item.isCompleted) {
    return false
  }
  const remindTime = parseRemindTimestamp(item.remindAt)
  return remindTime > 0 && remindTime < Date.now()
}

/**
 * @description 重置提醒表单到初始值。
 */
function resetForm() {
  form.value = {
    title: '',
    type: DEFAULT_REMINDER_TYPE,
    remindAt: null,
    description: '',
    professorId: '',
  }
}

/**
 * @description 弹窗关闭后重置编辑状态与校验状态。
 */
function resetModalState() {
  editingId.value = null
  formRef.value?.restoreValidation()
  resetForm()
}

/**
 * @description 获取提醒列表。
 */
async function fetchList() {
  loading.value = true
  try {
    const res = await reminderApi.list({ completed: isCompletedTab.value })
    list.value = extractReminderList(res.data)
  } catch (error) {
    message.error(getErrorMessage(error, '获取提醒列表失败'))
  } finally {
    loading.value = false
  }
}

/**
 * @description 获取导师下拉选项。
 */
async function fetchProfessors() {
  try {
    const res = await professorApi.list()
    const arr = Array.isArray(res.data?.data) ? res.data.data : []
    professorOptions.value = arr.map((p: any) => ({
      label: p.name + '（' + p.university + '）',
      value: p.id,
    }))
  } catch {}
}

/**
 * @description 切换 Tab 时重新拉取提醒列表。
 */
function handleTabChange() {
  void fetchList()
}

/**
 * @description 打开新建提醒弹窗。
 */
function openCreateModal() {
  editingId.value = null
  resetForm()
  formRef.value?.restoreValidation()
  showModal.value = true
}

/**
 * @description 打开编辑提醒弹窗并回填数据。
 * @param item 待编辑提醒项
 */
function openEditModal(item: Reminder) {
  editingId.value = item.id
  form.value = {
    title: item.title,
    type: item.type,
    remindAt: parseRemindTimestamp(item.remindAt),
    description: item.description ?? '',
    professorId: item.professorId ?? '',
  }
  formRef.value?.restoreValidation()
  showModal.value = true
}

/**
 * @description 提交新建或编辑提醒。
 */
async function handleSubmit() {
  if (submitting.value) {
    return
  }

  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  if (!form.value.remindAt) {
    message.warning('请选择提醒时间')
    return
  }

  submitting.value = true
  const payload = {
    title: form.value.title.trim(),
    type: form.value.type,
    remindAt: new Date(form.value.remindAt).toISOString(),
    description: form.value.description.trim() || null,
    professorId: (form.value.professorId ?? '').trim() || null,
  }

  try {
    if (editingId.value) {
      await reminderApi.update(editingId.value, payload)
      message.success('提醒更新成功')
    } else {
      await reminderApi.create(payload)
      message.success('提醒创建成功')
    }

    showModal.value = false
    await fetchList()
  } catch (error) {
    const fallback = editingId.value ? '更新提醒失败' : '创建提醒失败'
    message.error(getErrorMessage(error, fallback))
  } finally {
    submitting.value = false
  }
}

/**
 * @description 标记提醒为已完成。
 * @param id 提醒 ID
 */
async function handleComplete(id: string) {
  try {
    await reminderApi.complete(id)
    message.success('已标记为完成')
    await fetchList()
  } catch (error) {
    message.error(getErrorMessage(error, '标记完成失败'))
  }
}

/**
 * @description 删除提醒。
 * @param id 提醒 ID
 */
async function handleDelete(id: string) {
  try {
    await reminderApi.remove(id)
    message.success('删除成功')
    await fetchList()
  } catch (error) {
    message.error(getErrorMessage(error, '删除提醒失败'))
  }
}

onMounted(() => {
  void fetchList()
  void fetchProfessors()
})
</script>

<style scoped>
.reminder-page {
  gap: 14px;
}

.reminder-list {
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.7);
}

.reminder-list :deep(.n-list-item) {
  transition: background-color 0.2s ease;
}

.reminder-list :deep(.n-list-item:hover) {
  background: rgba(58, 123, 255, 0.05);
}
</style>
