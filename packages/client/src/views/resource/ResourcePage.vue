<template>
  <div class="app-page resource-page">
    <div class="app-page-header">
      <n-page-header title="资料专区" subtitle="支持分类、搜索、置顶、批量导入、失效检测与分类管理" />
      <n-space>
        <n-button @click="handleOpenCategoryModal">分类管理</n-button>
        <n-button :loading="checkAllLoading" @click="handleCheckAllLinks">失效检测</n-button>
        <n-button @click="handleOpenBatchModal">批量导入</n-button>
        <n-button type="primary" @click="handleOpenCreateModal">新增链接</n-button>
      </n-space>
    </div>

    <n-card class="app-card resource-filter-card">
      <n-space wrap :size="[12, 12]">
        <n-input
          v-model:value="filterModel.keyword"
          clearable
          style="width: 260px"
          placeholder="搜索标题 / 备注 / 链接地址"
          @keyup.enter="handleSearch"
        />
        <n-select
          v-model:value="filterModel.category"
          style="width: 200px"
          :options="categoryOptions"
        />
        <n-select
          v-model:value="filterModel.pinned"
          style="width: 150px"
          :options="pinnedOptions"
        />
        <n-select
          v-model:value="filterModel.sort"
          style="width: 180px"
          :options="sortOptions"
        />
        <n-button type="primary" @click="handleSearch">搜索</n-button>
        <n-button @click="handleResetFilter">重置</n-button>
      </n-space>
    </n-card>

    <n-card class="app-card resource-report-card">
      <n-space justify="space-between" align="center" style="width: 100%">
        <div class="resource-report-main">
          <div class="resource-report-title">最新巡检报告</div>
          <div class="resource-report-meta">
            <template v-if="latestReport">
              {{ formatDateTime(latestReport.createdAt, '-') }} ·
              {{ latestReport.triggerType === 'SCHEDULED' ? '定时巡检' : '手动巡检' }}
            </template>
            <template v-else>
              暂无巡检报告，点击“失效检测”后会自动生成
            </template>
          </div>
        </div>
        <n-button size="small" :loading="reportLoading" @click="handleRefreshLatestReport">刷新报告</n-button>
      </n-space>

      <n-space v-if="latestReport" wrap :size="[8, 8]" class="resource-report-tags">
        <n-tag size="small" type="info" :bordered="false">总数 {{ latestReport.totalCount }}</n-tag>
        <n-tag size="small" type="success" :bordered="false">可用 {{ latestReport.availableCount }}</n-tag>
        <n-tag size="small" type="error" :bordered="false">失效 {{ latestReport.unavailableCount }}</n-tag>
        <n-tag size="small" :bordered="false">未知 {{ latestReport.unknownCount }}</n-tag>
        <n-tag size="small" :bordered="false">跳过 {{ latestReport.skippedCount }}</n-tag>
      </n-space>
    </n-card>

    <n-card class="app-card">
      <n-spin :show="loading">
        <div class="resource-table-wrap">
          <n-empty
            v-if="!loading && resourceList.length === 0"
            description="暂无资料链接，点击“新增链接”或“批量导入”开始添加"
            class="app-empty"
          />

          <n-data-table
            v-else
            :columns="columns"
            :data="resourceList"
            :row-key="(row: ResourceItem) => row.id"
          />
        </div>
      </n-spin>
    </n-card>

    <n-modal
      v-model:show="showModal"
      preset="card"
      :title="editingResourceId ? '编辑资料链接' : '新增资料链接'"
      style="width: 680px"
      :mask-closable="false"
      @after-leave="resetModalState"
    >
      <n-form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        label-placement="top"
        require-mark-placement="right-hanging"
      >
        <n-form-item label="标题" path="title">
          <n-input
            v-model:value="formModel.title"
            maxlength="100"
            clearable
            placeholder="例如：机器学习课程与教程汇总"
          />
        </n-form-item>

        <n-form-item label="链接地址" path="url">
          <n-input
            v-model:value="formModel.url"
            maxlength="300"
            clearable
            placeholder="支持 https://xxx 或直接填写域名"
          />
        </n-form-item>

        <n-form-item label="分类">
          <n-input
            v-model:value="formModel.category"
            maxlength="30"
            clearable
            placeholder="例如：论文 / 课程 / 工具 / 项目"
          />
        </n-form-item>

        <n-form-item label="备注">
          <n-input
            v-model:value="formModel.description"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-count
            placeholder="可选：记录这个链接的用途、重点内容等"
          />
        </n-form-item>

        <n-form-item label="置顶">
          <n-switch v-model:value="formModel.isPinned" />
        </n-form-item>
      </n-form>

      <template #footer>
        <div class="resource-modal-footer">
          <n-button @click="showModal = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="handleSubmit">
            保存
          </n-button>
        </div>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showBatchModal"
      preset="card"
      title="批量导入资料链接"
      style="width: 760px"
      :mask-closable="false"
      @after-leave="resetBatchModalState"
    >
      <n-space vertical :size="10">
        <n-alert type="info" :show-icon="false">
          每行一条，支持两种格式：1）仅填 URL；2）标题 | URL | 分类 | 备注 | 置顶(是/否)
        </n-alert>
        <n-input
          v-model:value="batchInputValue"
          type="textarea"
          :rows="12"
          maxlength="12000"
          show-count
          placeholder="示例1：https://example.com&#10;示例2：深度学习课程 | https://course.example.com | 课程 | 入门资料 | 是"
        />
      </n-space>

      <template #footer>
        <div class="resource-modal-footer">
          <n-button @click="showBatchModal = false">取消</n-button>
          <n-button type="primary" :loading="batchImporting" @click="handleBatchImport">
            开始导入
          </n-button>
        </div>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showCategoryModal"
      preset="card"
      title="分类管理（重命名 / 合并）"
      style="width: 560px"
      :mask-closable="false"
      @after-leave="resetCategoryModalState"
    >
      <n-form label-placement="top" require-mark-placement="right-hanging">
        <n-form-item label="源分类">
          <n-select
            v-model:value="categoryForm.fromCategory"
            :options="categoryManageOptions"
            placeholder="请选择源分类"
          />
        </n-form-item>

        <n-form-item label="目标分类">
          <n-input
            v-model:value="categoryForm.toCategory"
            maxlength="30"
            clearable
            placeholder="输入目标分类名称"
          />
        </n-form-item>

        <n-alert type="warning" :show-icon="false">
          重命名要求目标分类不存在；合并可将源分类链接并入已有目标分类。
        </n-alert>
      </n-form>

      <template #footer>
        <div class="resource-modal-footer">
          <n-button @click="showCategoryModal = false">取消</n-button>
          <n-button :loading="categorySubmitting" @click="handleRenameCategory">重命名</n-button>
          <n-button type="primary" :loading="categorySubmitting" @click="handleMergeCategory">合并分类</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import {
  NButton,
  NPopconfirm,
  NTag,
  useMessage,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import { resourceApi } from '@/api'

interface ResourceItem {
  id: string
  title: string
  url: string
  category: string
  isPinned: boolean
  visitCount: number
  lastVisitedAt: string | null
  healthStatus: 'UNKNOWN' | 'AVAILABLE' | 'UNAVAILABLE' | string
  lastCheckedAt: string | null
  lastCheckStatusCode: number | null
  description: string | null
  createdAt: string
  updatedAt: string
}

interface ResourceCategoryCounter {
  category: string
  count: number
}

interface ResourceFormModel {
  title: string
  url: string
  category: string
  description: string
  isPinned: boolean
}

interface ResourceBatchPayload {
  title: string
  url: string
  category: string
  description: string | null
  isPinned: boolean
}

interface ResourceBatchResult {
  total: number
  createdCount: number
  duplicateCount: number
  invalidCount: number
}

interface ResourceCheckBatchResult {
  totalCount: number
  checkedCount: number
  availableCount: number
  unavailableCount: number
  unknownCount: number
  skippedCount: number
  reportId?: string
  reportCreatedAt?: string
  triggerType?: 'MANUAL' | 'SCHEDULED'
}

interface ResourceHealthLatestReport {
  id: string
  triggerType: 'MANUAL' | 'SCHEDULED'
  totalCount: number
  checkedCount: number
  availableCount: number
  unavailableCount: number
  unknownCount: number
  skippedCount: number
  createdAt: string
}

type PinnedFilter = 'ALL' | 'PINNED' | 'UNPINNED'
type SortFilter = 'UPDATED' | 'CREATED' | 'VISITED' | 'POPULAR'

const DEFAULT_CATEGORY = '未分类'

const message = useMessage()

const loading = ref(false)
const saving = ref(false)
const batchImporting = ref(false)
const categorySubmitting = ref(false)
const checkAllLoading = ref(false)
const reportLoading = ref(false)
const showModal = ref(false)
const showBatchModal = ref(false)
const showCategoryModal = ref(false)
const editingResourceId = ref<string | null>(null)
const checkingItemIds = ref<string[]>([])
const formRef = ref<FormInst | null>(null)

const resourceList = ref<ResourceItem[]>([])
const categoryStats = ref<ResourceCategoryCounter[]>([])
const latestReport = ref<ResourceHealthLatestReport | null>(null)
const batchInputValue = ref('')

const filterModel = reactive({
  keyword: '',
  category: 'ALL',
  pinned: 'ALL' as PinnedFilter,
  sort: 'UPDATED' as SortFilter,
})

const categoryForm = reactive({
  fromCategory: '',
  toCategory: '',
})

const formModel = reactive<ResourceFormModel>({
  title: '',
  url: '',
  category: DEFAULT_CATEGORY,
  description: '',
  isPinned: false,
})

const pinnedOptions = [
  { label: '全部', value: 'ALL' },
  { label: '仅置顶', value: 'PINNED' },
  { label: '仅非置顶', value: 'UNPINNED' },
]

const sortOptions = [
  { label: '最近更新', value: 'UPDATED' },
  { label: '最近创建', value: 'CREATED' },
  { label: '最近访问', value: 'VISITED' },
  { label: '访问最多', value: 'POPULAR' },
]

const categoryOptions = computed(() => [
  { label: '全部分类', value: 'ALL' },
  ...categoryStats.value.map((item) => ({
    label: `${item.category} (${item.count})`,
    value: item.category,
  })),
])

const categoryManageOptions = computed(() =>
  categoryStats.value.map((item) => ({
    label: `${item.category} (${item.count})`,
    value: item.category,
  }))
)

const formRules: FormRules = {
  title: [{ required: true, message: '请输入标题', trigger: ['blur', 'input'] }],
  url: [{ required: true, message: '请输入链接地址', trigger: ['blur', 'input'] }],
}

/**
 * @description 提取接口错误消息。
 * @param error 错误对象
 * @param fallback 兜底提示
 * @returns 可展示的错误消息
 */
function getApiErrorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback
}

/**
 * @description 归一化链接地址并补全协议。
 * @param value 原始链接
 * @returns 标准化链接
 */
function normalizeUrl(value: string): string | null {
  const raw = value.trim()
  if (!raw) {
    return null
  }

  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`

  try {
    const parsed = new URL(withProtocol)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * @description 归一化分类名称。
 * @param value 分类输入
 * @returns 标准化分类
 */
function normalizeCategory(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return DEFAULT_CATEGORY
  }
  if (trimmed.length > 30) {
    return trimmed.slice(0, 30)
  }
  return trimmed
}

/**
 * @description 从 URL 推导可读标题。
 * @param value 链接地址
 * @returns 推导后的标题
 */
function deriveTitleFromUrl(value: string): string {
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.replace(/^www\./, '')
    return host || '未命名链接'
  } catch {
    return '未命名链接'
  }
}

/**
 * @description 解析置顶字段输入。
 * @param value 置顶文本
 * @returns 是否置顶
 */
function parsePinValue(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return ['1', 'true', 'y', 'yes', '是', '置顶'].includes(normalized)
}

/**
 * @description 格式化时间。
 * @param value 时间字符串
 * @param fallback 空值兜底文本
 * @returns 格式化结果
 */
function formatDateTime(value: string | null, fallback = '-'): string {
  if (!value) {
    return fallback
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleString('zh-CN')
}

/**
 * @description 获取健康状态文案。
 * @param status 健康状态值
 * @returns 展示文案
 */
function getHealthLabel(status: string): string {
  if (status === 'AVAILABLE') {
    return '可用'
  }
  if (status === 'UNAVAILABLE') {
    return '失效'
  }
  return '未知'
}

/**
 * @description 获取健康状态标签类型。
 * @param status 健康状态值
 * @returns 标签类型
 */
function getHealthTagType(status: string): 'default' | 'success' | 'error' {
  if (status === 'AVAILABLE') {
    return 'success'
  }
  if (status === 'UNAVAILABLE') {
    return 'error'
  }
  return 'default'
}

/**
 * @description 判断是否正在检测某条链接。
 * @param id 资料链接 ID
 * @returns 是否检测中
 */
function isItemChecking(id: string): boolean {
  return checkingItemIds.value.includes(id)
}

/**
 * @description 将筛选项转换为接口参数。
 * @returns 列表查询参数
 */
function buildListParams() {
  const sortMap: Record<SortFilter, 'updated' | 'created' | 'visited' | 'popular'> = {
    UPDATED: 'updated',
    CREATED: 'created',
    VISITED: 'visited',
    POPULAR: 'popular',
  }

  const params: {
    keyword?: string
    category?: string
    pinned?: boolean
    sort?: 'updated' | 'created' | 'visited' | 'popular'
  } = {
    sort: sortMap[filterModel.sort],
  }

  const keyword = filterModel.keyword.trim()
  if (keyword) {
    params.keyword = keyword
  }

  if (filterModel.category !== 'ALL') {
    params.category = filterModel.category
  }

  if (filterModel.pinned === 'PINNED') {
    params.pinned = true
  } else if (filterModel.pinned === 'UNPINNED') {
    params.pinned = false
  }

  return params
}

/**
 * @description 解析批量导入文本。
 * @param inputText 粘贴内容
 * @returns 结构化导入数据
 */
function parseBatchInput(inputText: string): { items: ResourceBatchPayload[]; invalidLineCount: number } {
  const lines = inputText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const parsedItems: ResourceBatchPayload[] = []
  let invalidLineCount = 0

  for (const line of lines) {
    if (line.includes('|')) {
      const parts = line.split('|').map((part) => part.trim())
      const title = parts[0]
      const normalizedUrl = normalizeUrl(parts[1] || '')

      if (!title || !normalizedUrl) {
        invalidLineCount += 1
        continue
      }

      parsedItems.push({
        title,
        url: normalizedUrl,
        category: normalizeCategory(parts[2] || DEFAULT_CATEGORY),
        description: parts[3]?.trim() || null,
        isPinned: parsePinValue(parts[4] || ''),
      })
      continue
    }

    const normalizedUrl = normalizeUrl(line)
    if (!normalizedUrl) {
      invalidLineCount += 1
      continue
    }

    parsedItems.push({
      title: deriveTitleFromUrl(normalizedUrl),
      url: normalizedUrl,
      category: DEFAULT_CATEGORY,
      description: null,
      isPinned: false,
    })
  }

  const uniqueByUrlMap = new Map<string, ResourceBatchPayload>()
  for (const item of parsedItems) {
    if (!uniqueByUrlMap.has(item.url)) {
      uniqueByUrlMap.set(item.url, item)
    }
  }

  return {
    items: Array.from(uniqueByUrlMap.values()),
    invalidLineCount,
  }
}

/**
 * @description 提取分类管理表单值。
 * @returns 表单值
 */
function getCategoryMutationPayload(): { fromCategory: string; toCategory: string } | null {
  const fromCategory = categoryForm.fromCategory.trim()
  const toCategory = normalizeCategory(categoryForm.toCategory)

  if (!fromCategory || !toCategory) {
    return null
  }
  if (fromCategory === toCategory) {
    return null
  }

  return { fromCategory, toCategory }
}

/**
 * @description 重置表单状态。
 */
function resetForm() {
  formModel.title = ''
  formModel.url = ''
  formModel.category = DEFAULT_CATEGORY
  formModel.description = ''
  formModel.isPinned = false
}

/**
 * @description 弹窗关闭后清理状态。
 */
function resetModalState() {
  editingResourceId.value = null
  formRef.value?.restoreValidation()
  resetForm()
}

/**
 * @description 批量导入弹窗关闭后清理状态。
 */
function resetBatchModalState() {
  batchInputValue.value = ''
}

/**
 * @description 分类管理弹窗关闭后清理状态。
 */
function resetCategoryModalState() {
  categoryForm.fromCategory = ''
  categoryForm.toCategory = ''
}

/**
 * @description 获取分类统计。
 */
async function fetchCategoryStats() {
  try {
    const response = await resourceApi.categories()
    const list = (response.data as { data?: unknown }).data
    categoryStats.value = Array.isArray(list) ? (list as ResourceCategoryCounter[]) : []
  } catch (error) {
    message.error(getApiErrorMessage(error, '获取分类统计失败'))
  }
}

/**
 * @description 获取最新巡检报告。
 */
async function fetchLatestReport() {
  reportLoading.value = true
  try {
    const response = await resourceApi.latestReport()
    const report = (response.data as { data?: unknown }).data
    latestReport.value = report && typeof report === 'object' ? (report as ResourceHealthLatestReport) : null
  } catch (error) {
    latestReport.value = null
    message.error(getApiErrorMessage(error, '获取巡检报告失败'))
  } finally {
    reportLoading.value = false
  }
}

/**
 * @description 获取资料链接列表。
 */
async function fetchResourceList() {
  loading.value = true
  try {
    const response = await resourceApi.list(buildListParams())
    const list = (response.data as { data?: unknown }).data
    resourceList.value = Array.isArray(list) ? (list as ResourceItem[]) : []
  } catch (error) {
    message.error(getApiErrorMessage(error, '获取资料链接失败'))
  } finally {
    loading.value = false
  }
}

/**
 * @description 搜索列表。
 */
function handleSearch() {
  void fetchResourceList()
}

/**
 * @description 重置筛选并刷新列表。
 */
function handleResetFilter() {
  filterModel.keyword = ''
  filterModel.category = 'ALL'
  filterModel.pinned = 'ALL'
  filterModel.sort = 'UPDATED'
  void fetchResourceList()
}

/**
 * @description 打开新增弹窗。
 */
function handleOpenCreateModal() {
  editingResourceId.value = null
  resetForm()
  formRef.value?.restoreValidation()
  showModal.value = true
}

/**
 * @description 打开批量导入弹窗。
 */
function handleOpenBatchModal() {
  showBatchModal.value = true
}

/**
 * @description 打开分类管理弹窗。
 */
function handleOpenCategoryModal() {
  if (categoryStats.value.length === 0) {
    message.warning('暂无分类可管理')
    return
  }
  categoryForm.fromCategory = categoryStats.value[0]?.category ?? ''
  categoryForm.toCategory = ''
  showCategoryModal.value = true
}

/**
 * @description 打开编辑弹窗并回填。
 * @param item 当前资料项
 */
function handleOpenEditModal(item: ResourceItem) {
  editingResourceId.value = item.id
  formModel.title = item.title
  formModel.url = item.url
  formModel.category = item.category || DEFAULT_CATEGORY
  formModel.description = item.description ?? ''
  formModel.isPinned = item.isPinned
  formRef.value?.restoreValidation()
  showModal.value = true
}

/**
 * @description 提交新增或编辑。
 */
async function handleSubmit() {
  if (saving.value) {
    return
  }

  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  const title = formModel.title.trim()
  const normalizedUrl = normalizeUrl(formModel.url)
  if (!title) {
    message.warning('标题不能为空')
    return
  }
  if (!normalizedUrl) {
    message.warning('链接地址格式不正确')
    return
  }

  saving.value = true
  const payload = {
    title,
    url: normalizedUrl,
    category: normalizeCategory(formModel.category),
    description: formModel.description.trim() || null,
    isPinned: formModel.isPinned,
  }

  try {
    if (editingResourceId.value) {
      await resourceApi.update(editingResourceId.value, payload)
      message.success('资料链接更新成功')
    } else {
      await resourceApi.create(payload)
      message.success('资料链接创建成功')
    }

    showModal.value = false
    await Promise.all([fetchResourceList(), fetchCategoryStats()])
  } catch (error) {
    const fallback = editingResourceId.value ? '更新资料链接失败' : '创建资料链接失败'
    message.error(getApiErrorMessage(error, fallback))
  } finally {
    saving.value = false
  }
}

/**
 * @description 提交批量导入。
 */
async function handleBatchImport() {
  if (batchImporting.value) {
    return
  }

  const parsed = parseBatchInput(batchInputValue.value)
  if (parsed.items.length === 0) {
    message.warning('未解析到可导入的有效链接')
    return
  }

  batchImporting.value = true
  try {
    const response = await resourceApi.batchCreate(parsed.items)
    const result = (response.data as { data?: unknown }).data as ResourceBatchResult | undefined
    const createdCount = result?.createdCount ?? 0
    const duplicateCount = result?.duplicateCount ?? 0
    const invalidCount = (result?.invalidCount ?? 0) + parsed.invalidLineCount
    message.success(`批量导入完成：新增 ${createdCount}，重复 ${duplicateCount}，无效 ${invalidCount}`)
    showBatchModal.value = false
    await Promise.all([fetchResourceList(), fetchCategoryStats()])
  } catch (error) {
    message.error(getApiErrorMessage(error, '批量导入失败'))
  } finally {
    batchImporting.value = false
  }
}

/**
 * @description 执行分类变更。
 * @param type 变更类型
 */
async function runCategoryMutation(type: 'rename' | 'merge') {
  if (categorySubmitting.value) {
    return
  }

  const payload = getCategoryMutationPayload()
  if (!payload) {
    message.warning('请正确填写源分类与目标分类，且两者不能相同')
    return
  }

  categorySubmitting.value = true
  try {
    if (type === 'rename') {
      await resourceApi.renameCategory(payload)
      message.success('分类重命名成功')
    } else {
      await resourceApi.mergeCategory(payload)
      message.success('分类合并成功')
    }

    showCategoryModal.value = false
    await Promise.all([fetchCategoryStats(), fetchResourceList()])
  } catch (error) {
    message.error(getApiErrorMessage(error, type === 'rename' ? '分类重命名失败' : '分类合并失败'))
  } finally {
    categorySubmitting.value = false
  }
}

/**
 * @description 分类重命名。
 */
function handleRenameCategory() {
  void runCategoryMutation('rename')
}

/**
 * @description 分类合并。
 */
function handleMergeCategory() {
  void runCategoryMutation('merge')
}

/**
 * @description 批量检测资料链接可用性。
 */
async function handleCheckAllLinks() {
  if (checkAllLoading.value) {
    return
  }

  checkAllLoading.value = true
  try {
    const response = await resourceApi.checkAll()
    const result = (response.data as { data?: unknown }).data as ResourceCheckBatchResult | undefined
    const checked = result?.checkedCount ?? 0
    const available = result?.availableCount ?? 0
    const unavailable = result?.unavailableCount ?? 0
    const unknown = result?.unknownCount ?? 0
    const skipped = result?.skippedCount ?? 0
    message.success(`检测完成：检测 ${checked} 条，可用 ${available}，失效 ${unavailable}，未知 ${unknown}，跳过 ${skipped}`)
    await Promise.all([fetchResourceList(), fetchLatestReport()])
  } catch (error) {
    message.error(getApiErrorMessage(error, '批量检测失败'))
  } finally {
    checkAllLoading.value = false
  }
}

/**
 * @description 手动刷新最新巡检报告。
 */
function handleRefreshLatestReport() {
  void fetchLatestReport()
}

/**
 * @description 检测单条资料链接可用性。
 * @param item 当前资料项
 */
async function handleCheckLink(item: ResourceItem) {
  if (isItemChecking(item.id)) {
    return
  }

  checkingItemIds.value = [...checkingItemIds.value, item.id]
  try {
    const response = await resourceApi.check(item.id)
    const apiMessage = (response.data as { message?: string }).message
    message.success(apiMessage || '检测完成')
    await fetchResourceList()
  } catch (error) {
    message.error(getApiErrorMessage(error, '链接检测失败'))
  } finally {
    checkingItemIds.value = checkingItemIds.value.filter((id) => id !== item.id)
  }
}

/**
 * @description 删除资料链接。
 * @param item 当前资料项
 */
async function handleDelete(item: ResourceItem) {
  try {
    await resourceApi.remove(item.id)
    message.success('删除成功')
    await Promise.all([fetchResourceList(), fetchCategoryStats()])
  } catch (error) {
    message.error(getApiErrorMessage(error, '删除资料链接失败'))
  }
}

/**
 * @description 切换置顶状态。
 * @param item 当前资料项
 */
async function handleTogglePin(item: ResourceItem) {
  try {
    await resourceApi.pin(item.id, !item.isPinned)
    message.success(item.isPinned ? '已取消置顶' : '已置顶')
    await fetchResourceList()
  } catch (error) {
    message.error(getApiErrorMessage(error, '更新置顶状态失败'))
  }
}

/**
 * @description 记录链接访问。
 * @param id 资料链接 ID
 */
async function recordVisit(id: string) {
  try {
    await resourceApi.visit(id)
    await fetchResourceList()
  } catch {
    // 访问统计失败不阻断跳转
  }
}

/**
 * @description 打开资料链接。
 * @param item 当前资料项
 */
function handleOpenLink(item: ResourceItem) {
  window.open(item.url, '_blank', 'noopener,noreferrer')
  void recordVisit(item.id)
}

/**
 * @description 复制资料链接。
 * @param item 当前资料项
 */
async function handleCopyLink(item: ResourceItem) {
  try {
    await navigator.clipboard.writeText(item.url)
    message.success('链接已复制')
  } catch {
    message.error('复制失败，请手动复制链接')
  }
}

const columns: DataTableColumns<ResourceItem> = [
  {
    title: '置顶',
    key: 'isPinned',
    width: 88,
    render: (row) =>
      row.isPinned
        ? h(
            NTag,
            {
              size: 'small',
              type: 'warning',
              bordered: false,
            },
            { default: () => '置顶' }
          )
        : '-',
  },
  {
    title: '标题',
    key: 'title',
    ellipsis: {
      tooltip: true,
    },
  },
  {
    title: '分类',
    key: 'category',
    width: 120,
    render: (row) => row.category || DEFAULT_CATEGORY,
  },
  {
    title: '健康状态',
    key: 'healthStatus',
    width: 170,
    render: (row) =>
      h('div', { class: 'resource-health-cell' }, [
        h(
          NTag,
          {
            size: 'small',
            bordered: false,
            type: getHealthTagType(row.healthStatus),
          },
          { default: () => getHealthLabel(row.healthStatus) }
        ),
        h(
          'div',
          { class: 'resource-health-extra' },
          `检测：${formatDateTime(row.lastCheckedAt, '未检测')}`
        ),
        row.lastCheckStatusCode
          ? h('div', { class: 'resource-health-extra' }, `状态码：${row.lastCheckStatusCode}`)
          : null,
      ]),
  },
  {
    title: '访问',
    key: 'visitCount',
    width: 130,
    render: (row) =>
      h('div', { class: 'resource-visit-cell' }, [
        h('div', { class: 'resource-visit-count' }, `${row.visitCount ?? 0} 次`),
        h('div', { class: 'resource-visit-time' }, formatDateTime(row.lastVisitedAt, '未访问')),
      ]),
  },
  {
    title: '链接地址',
    key: 'url',
    render: (row) =>
      h(
        'a',
        {
          href: row.url,
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'resource-url-link',
        },
        row.url
      ),
  },
  {
    title: '备注',
    key: 'description',
    render: (row) => row.description || '-',
    ellipsis: {
      tooltip: true,
    },
  },
  {
    title: '更新时间',
    key: 'updatedAt',
    width: 180,
    render: (row) => formatDateTime(row.updatedAt, '-'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 380,
    render: (row) =>
      h('div', { class: 'resource-actions' }, [
        h(
          NButton,
          {
            size: 'small',
            tertiary: true,
            onClick: () => handleOpenLink(row),
          },
          { default: () => '打开' }
        ),
        h(
          NButton,
          {
            size: 'small',
            tertiary: true,
            onClick: () => {
              void handleCopyLink(row)
            },
          },
          { default: () => '复制' }
        ),
        h(
          NButton,
          {
            size: 'small',
            tertiary: true,
            loading: isItemChecking(row.id),
            onClick: () => {
              void handleCheckLink(row)
            },
          },
          { default: () => '检测' }
        ),
        h(
          NButton,
          {
            size: 'small',
            tertiary: true,
            onClick: () => {
              void handleTogglePin(row)
            },
          },
          { default: () => (row.isPinned ? '取消置顶' : '置顶') }
        ),
        h(
          NButton,
          {
            size: 'small',
            onClick: () => handleOpenEditModal(row),
          },
          { default: () => '编辑' }
        ),
        h(
          NPopconfirm,
          {
            onPositiveClick: () => {
              void handleDelete(row)
            },
          },
          {
            trigger: () =>
              h(
                NButton,
                {
                  size: 'small',
                  type: 'error',
                  secondary: true,
                },
                { default: () => '删除' }
              ),
            default: () => '确认删除这条资料链接吗？',
          }
        ),
      ]),
  },
]

onMounted(async () => {
  await Promise.all([fetchCategoryStats(), fetchResourceList(), fetchLatestReport()])
})
</script>

<style scoped>
.resource-filter-card {
  margin-bottom: 12px;
}

.resource-report-card {
  margin-bottom: 12px;
}

.resource-report-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.resource-report-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.resource-report-meta {
  font-size: 12px;
  color: #64748b;
}

.resource-report-tags {
  margin-top: 10px;
}

.resource-table-wrap {
  min-height: 240px;
}

.resource-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.resource-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.resource-health-cell,
.resource-visit-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.resource-health-extra,
.resource-visit-time {
  font-size: 12px;
  color: #909399;
}

.resource-visit-count {
  font-weight: 600;
  color: #1f2937;
}

.resource-url-link {
  color: #3a7bff;
  text-decoration: none;
}

.resource-url-link:hover {
  text-decoration: underline;
}
</style>
