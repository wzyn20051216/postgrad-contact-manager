<template>
  <div class="app-page data-page">
    <div class="app-page-header">
      <n-page-header title="数据管理" subtitle="导入导出你的数据" />
      <span class="app-chip">建议每周至少备份 1 次</span>
    </div>

    <n-grid cols="1 s:3" responsive="screen" :x-gap="16" :y-gap="16">
      <n-gi>
        <n-card title="导出数据" size="small" class="app-card section-card">
          <p class="card-description">导出所有导师数据，可用于备份与迁移</p>
          <n-space :size="8" class="export-actions">
            <n-button type="primary" :loading="exportLoading" @click="handleExport">
              <template #icon>
                <n-icon>
                  <DownloadOutline />
                </n-icon>
              </template>
              导出 JSON
            </n-button>
            <n-button secondary disabled>
              <template #icon>
                <n-icon>
                  <DocumentTextOutline />
                </n-icon>
              </template>
              CSV
            </n-button>
            <n-button secondary disabled>
              <template #icon>
                <n-icon>
                  <DocumentOutline />
                </n-icon>
              </template>
              Excel
            </n-button>
          </n-space>
        </n-card>
      </n-gi>

      <n-gi>
        <n-card title="导入数据" size="small" class="app-card section-card">
          <p class="card-description">上传 JSON 文件批量导入导师</p>
          <n-upload
            accept=".json"
            :show-file-list="false"
            :custom-request="handleImportRequest"
          >
            <n-button type="primary" :loading="importLoading">
              <template #icon>
                <n-icon>
                  <CloudUploadOutline />
                </n-icon>
              </template>
              导入 JSON
            </n-button>
          </n-upload>
        </n-card>
      </n-gi>

      <n-gi>
        <n-card title="清空数据" size="small" class="app-card">
          <p class="card-description danger-text">删除所有导师、面试、笔记等数据，不可恢复</p>
          <n-popconfirm
            v-model:show="clearConfirmVisible"
            positive-text="确认清空"
            negative-text="取消"
            :positive-button-props="{
              type: 'error',
              disabled: clearConfirmText !== clearKeyword || clearLoading,
              loading: clearLoading,
            }"
            @positive-click="handleClear"
            @update:show="handleClearConfirmShowChange"
          >
            <template #trigger>
              <n-button type="error">清空数据</n-button>
            </template>
            <n-space vertical :size="8">
              <span>此操作不可恢复，请输入“确认清空”后继续。</span>
              <n-input
                v-model:value="clearConfirmText"
                :disabled="clearLoading"
                placeholder="请输入“确认清空”"
              />
            </n-space>
          </n-popconfirm>
        </n-card>
      </n-gi>
    </n-grid>

    <n-card title="数据统计" size="small" class="app-card stats-card">
      <n-spin :show="statsLoading">
        <n-grid cols="1 s:3" responsive="screen" :x-gap="16" :y-gap="12">
          <n-gi>
            <n-statistic label="导师数" :value="stats.professorCount" />
          </n-gi>
          <n-gi>
            <n-statistic label="面试数" :value="stats.interviewCount" />
          </n-gi>
          <n-gi>
            <n-statistic label="笔记数" :value="stats.noteCount" />
          </n-gi>
        </n-grid>
      </n-spin>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMessage, type UploadCustomRequestOptions } from 'naive-ui'
import {
  CloudUploadOutline,
  DocumentOutline,
  DocumentTextOutline,
  DownloadOutline,
} from '@vicons/ionicons5'
import { dataApi, request } from '@/api'

interface OverviewStats {
  professorCount: number
  interviewCount: number
  noteCount: number
}

const clearKeyword = '确认清空'

const message = useMessage()

const exportLoading = ref(false)
const importLoading = ref(false)
const clearLoading = ref(false)
const statsLoading = ref(false)

const clearConfirmVisible = ref(false)
const clearConfirmText = ref('')

const stats = ref<OverviewStats>(createEmptyStats())

function createEmptyStats(): OverviewStats {
  return {
    professorCount: 0,
    interviewCount: 0,
    noteCount: 0,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeCount(value: unknown): number {
  const count = Number(value)
  if (!Number.isFinite(count) || count < 0) {
    return 0
  }
  return Math.trunc(count)
}

function extractOverview(payload: unknown): OverviewStats {
  let source = payload

  if (isRecord(payload) && isRecord(payload.data)) {
    source = payload.data
  }

  if (!isRecord(source)) {
    return createEmptyStats()
  }

  const noteCountValue = 'noteCount' in source ? source.noteCount : source.notesCount

  return {
    professorCount: normalizeCount(source.professorCount),
    interviewCount: normalizeCount(source.interviewCount),
    noteCount: normalizeCount(noteCountValue),
  }
}

function unwrapDataPayload(payload: unknown): unknown {
  let source = payload

  for (let index = 0; index < 3; index += 1) {
    if (!isRecord(source) || !('data' in source)) {
      break
    }
    source = source.data
  }

  return source
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (isRecord(error) && isRecord(error.response) && isRecord(error.response.data)) {
    const maybeMessage = error.response.data.message
    if (typeof maybeMessage === 'string' && maybeMessage.trim().length > 0) {
      return maybeMessage
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}

async function fetchOverview() {
  statsLoading.value = true
  try {
    const response = await request.get('/api/stats/overview')
    stats.value = extractOverview(response.data)
  } catch (error) {
    message.error(getErrorMessage(error, '获取数据统计失败，请稍后重试'))
  } finally {
    statsLoading.value = false
  }
}

async function handleExport() {
  exportLoading.value = true
  try {
    const response = await dataApi.export()
    const professors = normalizeImportedProfessors(response.data)
    const content = JSON.stringify({ professors }, null, 2)
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `professors-data-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
    message.success('导出成功')
  } catch (error) {
    message.error(getErrorMessage(error, '导出数据失败，请稍后重试'))
  } finally {
    exportLoading.value = false
  }
}

function handleImportRequest(options: UploadCustomRequestOptions) {
  void importFromFile(options)
}

async function importFromFile(options: UploadCustomRequestOptions) {
  const currentFile = options.file.file

  if (!(currentFile instanceof File)) {
    options.onError()
    message.error('读取上传文件失败')
    return
  }

  importLoading.value = true
  try {
    options.onProgress({ percent: 20 })
    const rawText = await currentFile.text()
    const parsedData = JSON.parse(rawText) as unknown
    const professors = normalizeImportedProfessors(parsedData)
    options.onProgress({ percent: 70 })
    await dataApi.import({ professors })
    options.onProgress({ percent: 100 })
    options.onFinish()
    message.success(`导入成功，共 ${professors.length} 条导师数据`)
    await fetchOverview()
  } catch (error) {
    options.onError()
    message.error(getErrorMessage(error, '导入失败，请检查文件内容后重试'))
  } finally {
    importLoading.value = false
  }
}

function normalizeImportedProfessors(data: unknown): unknown[] {
  const normalized = unwrapDataPayload(data)

  if (Array.isArray(normalized)) {
    return normalized
  }

  if (isRecord(normalized) && Array.isArray(normalized.professors)) {
    return normalized.professors
  }

  throw new Error('JSON 格式错误，应为数组或 { professors: [] }')
}

function handleClearConfirmShowChange(show: boolean) {
  if (!show) {
    clearConfirmText.value = ''
  }
}

async function handleClear() {
  if (clearConfirmText.value !== clearKeyword) {
    message.warning(`请输入“${clearKeyword}”后再确认`)
    return
  }

  clearLoading.value = true
  try {
    await dataApi.clear()
    message.success('数据已清空')
    clearConfirmVisible.value = false
    clearConfirmText.value = ''
    await fetchOverview()
  } catch (error) {
    message.error(getErrorMessage(error, '清空数据失败，请稍后重试'))
  } finally {
    clearLoading.value = false
  }
}

onMounted(() => {
  void fetchOverview()
})
</script>

<style scoped>
.data-page {
  gap: 14px;
}

.card-description {
  margin: 0 0 16px;
  color: var(--n-text-color-2);
  min-height: 22px;
}

.section-card {
  height: 100%;
}

.stats-card {
  margin-top: 2px;
}

.export-actions {
  margin: 0 0 16px;
  flex-wrap: wrap;
}

.danger-text {
  color: var(--n-error-color);
}
</style>
