<template>
  <div class="app-page template-page">
    <div class="app-page-header">
      <n-page-header title="文书资料库" subtitle="集中管理简历、成绩单、个人陈述与推荐信素材" />
      <n-space>
        <n-button @click="handleOpenImportModal">导入本地文书</n-button>
        <n-button secondary @click="handleExportLocalTemplates">导出到本地</n-button>
        <n-button type="primary" ghost @click="handleOpenOnlineCreateModal">在线新建</n-button>
        <n-button type="primary" @click="handleOpenCreateModal">新建资料</n-button>
      </n-space>
    </div>

    <div class="template-filter-wrap">
      <n-radio-group :value="activeCategory" @update:value="handleCategoryChange">
        <n-radio-button value="ALL">全部</n-radio-button>
        <n-radio-button
          v-for="item in CATEGORIES"
          :key="item.value"
          :value="item.value"
        >
          {{ item.label }}
        </n-radio-button>
      </n-radio-group>
    </div>

    <n-card class="app-card">
      <n-spin :show="loading">
        <div class="template-content-wrap">
          <n-empty
            v-if="!loading && templateList.length === 0"
            description="暂无文书资料，点击“新建资料”或“导入本地文书”开始创建"
            class="app-empty"
          />

          <n-grid
            v-else
            cols="1 s:2 m:3"
            responsive="screen"
            :x-gap="16"
            :y-gap="16"
          >
            <n-gi v-for="item in templateList" :key="item.id">
              <n-card size="small" hoverable class="template-item-card">
                <div class="template-item-header">
                  <div class="truncate text-base font-medium">
                    {{ item.name }}
                  </div>
                  <n-tag size="small" type="info" :bordered="false">
                    {{ getCategoryLabel(item.category) }}
                  </n-tag>
                </div>

                <div class="template-path-line" :title="item.subject || '未填写路径'">
                  路径：{{ item.subject || '未填写' }}
                </div>

                <div class="line-clamp-4 template-content-text">
                  {{ item.content || '暂无内容摘要' }}
                </div>

                <div class="template-item-actions">
                  <n-button size="small" tertiary @click="handleOpenTemplate(item)">
                    打开
                  </n-button>
                  <n-button size="small" tertiary @click="handleOpenOnlineEditModal(item)">
                    在线编辑
                  </n-button>
                  <n-button size="small" tertiary @click="handleCopyPath(item.subject)">
                    复制路径
                  </n-button>
                  <n-button size="small" tertiary @click="handleCopyContent(item.content)">
                    复制摘要
                  </n-button>
                  <n-button size="small" @click="handleOpenEditModal(item)">
                    编辑
                  </n-button>
                  <n-popconfirm @positive-click="handleDeleteTemplate(item.id)">
                    <template #trigger>
                      <n-button size="small" type="error" secondary>
                        删除
                      </n-button>
                    </template>
                    确认删除该文书资料吗？
                  </n-popconfirm>
                </div>
              </n-card>
            </n-gi>
          </n-grid>
        </div>
      </n-spin>
    </n-card>

    <footer class="template-page-footer">
      <span>联系站点管理员获取帮助</span>
      <span>欢迎大家多多提意见</span>
    </footer>

    <n-modal
      v-model:show="showModal"
      preset="dialog"
      :title="modalTitle"
      style="width: min(980px, 92vw)"
      :mask-closable="false"
      positive-text="保存"
      negative-text="取消"
      :positive-button-props="{ loading: saving }"
      @positive-click="handleSubmitTemplate"
      @after-leave="resetModalState"
    >
      <n-form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        label-placement="top"
        require-mark-placement="right-hanging"
      >
        <n-form-item label="文书名称" path="name">
          <n-input
            v-model:value="formModel.name"
            placeholder="例如：个人简历（中英）"
            maxlength="60"
            clearable
          />
        </n-form-item>

        <n-form-item label="文书类型" path="category">
          <n-select
            v-model:value="formModel.category"
            :options="categoryOptions"
            placeholder="请选择文书类型"
          />
        </n-form-item>

        <n-form-item label="文件路径/链接（可选）">
          <n-input
            v-model:value="formModel.subject"
            placeholder="可填本地路径、网盘链接或文档地址"
            maxlength="300"
            clearable
          />
        </n-form-item>

        <n-form-item label="内容摘要/备注（可选）">
          <n-input
            v-model:value="formModel.content"
            type="textarea"
            :rows="16"
            placeholder="建议记录版本说明、投递院校差异、重点亮点等"
            maxlength="4000"
            show-count
          />
        </n-form-item>
      </n-form>
    </n-modal>

    <n-modal
      v-model:show="showImportModal"
      preset="dialog"
      title="导入本地文书（文件/文件夹）"
      style="width: 680px"
      :mask-closable="false"
      positive-text="开始导入"
      negative-text="取消"
      :positive-button-props="{ loading: importing }"
      @positive-click="handleImportFolder"
      @after-leave="resetImportModalState"
    >
      <n-space vertical :size="12">
        <n-alert type="info" :show-icon="false">
          支持格式：pdf、doc/docx、xls/xlsx、ppt/pptx、md、txt。可直接选择文件，也可选择整个文件夹。
        </n-alert>
        <n-space>
          <n-button @click="handlePickImportFiles">选择文件</n-button>
          <n-button secondary @click="handlePickImportFolder">选择文件夹</n-button>
          <n-button
            tertiary
            type="warning"
            :disabled="selectedImportFiles.length === 0"
            @click="clearSelectedImportFiles"
          >
            清空选择
          </n-button>
        </n-space>
        <div class="import-selection-summary">
          已选择 {{ selectedImportFiles.length }} 个文件
          <template v-if="unsupportedImportCount > 0">
            ，已过滤 {{ unsupportedImportCount }} 个不支持格式
          </template>
        </div>
        <div class="import-file-list">
          <n-empty
            v-if="selectedImportFiles.length === 0"
            size="small"
            description="请先选择要导入的文件或文件夹"
          />
          <ul v-else class="import-file-ul">
            <li v-for="item in selectedImportFiles.slice(0, 12)" :key="item.key" class="import-file-item">
              <span class="import-file-name" :title="item.relativePath">{{ item.relativePath }}</span>
              <n-tag size="small" :bordered="false">{{ item.extensionText }}</n-tag>
            </li>
          </ul>
          <div v-if="selectedImportFiles.length > 12" class="import-file-more">
            其余 {{ selectedImportFiles.length - 12 }} 个文件将在导入时一并处理
          </div>
        </div>

        <input
          ref="importFileInputRef"
          class="hidden-native-input"
          type="file"
          :accept="IMPORT_ACCEPT_ATTR"
          multiple
          @change="handleImportFilesSelected"
        >
        <input
          ref="importFolderInputRef"
          class="hidden-native-input"
          type="file"
          :accept="IMPORT_ACCEPT_ATTR"
          multiple
          webkitdirectory
          directory
          @change="handleImportFolderSelected"
        >
      </n-space>
    </n-modal>

    <n-modal
      v-model:show="showEditorModal"
      preset="card"
      :title="editorModalTitle"
      style="width: min(1280px, 95vw)"
      :mask-closable="false"
      @after-leave="resetEditorModalState"
    >
      <n-space vertical :size="12">
        <n-form
          ref="editorFormRef"
          :model="editorForm"
          :rules="editorFormRules"
          label-placement="top"
          require-mark-placement="right-hanging"
        >
          <n-grid cols="1 s:2" responsive="screen" :x-gap="12">
            <n-gi>
              <n-form-item label="文书名称" path="name">
                <n-input
                  v-model:value="editorForm.name"
                  placeholder="例如：个人陈述（2026 春招版）"
                  maxlength="80"
                  clearable
                />
              </n-form-item>
            </n-gi>
            <n-gi>
              <n-form-item label="文书类型" path="category">
                <n-select
                  v-model:value="editorForm.category"
                  :options="categoryOptions"
                  placeholder="请选择文书类型"
                />
              </n-form-item>
            </n-gi>
          </n-grid>

          <n-form-item label="关联路径/链接（可选）">
            <n-input
              v-model:value="editorForm.subject"
              placeholder="可关联本地文档路径或网盘链接"
              maxlength="300"
              clearable
            />
          </n-form-item>

          <n-form-item label="正文内容" path="content">
            <MarkdownWorkspace
              v-model="editorForm.content"
              placeholder="在这里在线撰写文书正文，支持标题、引用、列表、代码块与实时预览"
              min-height="56vh"
            />
          </n-form-item>
        </n-form>

        <n-space justify="space-between" align="start" class="editor-footer-wrap">
          <n-space vertical :size="8" class="editor-toolbar-left">
            <n-space align="center" :size="10">
              <span class="editor-status-text">
                {{ autoSaveStatusText }}
                <template v-if="draftUpdatedAtLabel">
                  · {{ draftUpdatedAtLabel }}
                </template>
              </span>
            </n-space>
            <n-space :size="8" :wrap="true">
              <n-button size="small" tertiary @click="handleManualSaveDraft">
                立即保存草稿
              </n-button>
              <n-button size="small" tertiary @click="handleRestoreDraft">
                恢复草稿
              </n-button>
              <n-button size="small" tertiary type="warning" @click="handleClearDraft">
                清空草稿
              </n-button>
            </n-space>
            <n-space align="center" :size="8" :wrap="true">
              <n-select
                v-model:value="selectedVersionId"
                :options="versionOptions"
                placeholder="选择历史版本回滚"
                clearable
                class="editor-version-select"
              />
              <n-button
                size="small"
                secondary
                :disabled="!selectedVersionId"
                @click="handleRollbackSelectedVersion"
              >
                回滚到该版本
              </n-button>
              <n-button
                size="small"
                secondary
                :disabled="!selectedVersionId"
                @click="handleOpenVersionDiff"
              >
                查看差异
              </n-button>
            </n-space>
          </n-space>
          <n-space>
            <n-button @click="showEditorModal = false">取消</n-button>
            <n-button type="primary" :loading="editorSaving" @click="handleSubmitOnlineEditor">
              保存在线文书
            </n-button>
          </n-space>
        </n-space>
      </n-space>
    </n-modal>

    <n-modal
      v-model:show="showVersionDiffModal"
      preset="card"
      title="历史版本差异"
      style="width: min(1000px, 92vw)"
      :mask-closable="true"
    >
      <n-space vertical :size="10">
        <n-alert type="info" :show-icon="false">
          {{ versionDiffHint }}
        </n-alert>
        <n-space justify="space-between" align="center" class="version-diff-toolbar">
          <n-space :size="10" align="center" :wrap="true">
            <span class="editor-status-text">
              显示模式：{{ versionDiffShowOnlyChanges ? '仅变更行' : '完整上下文' }}
            </span>
            <span class="editor-status-text">
              +{{ versionDiffStats.added }} / -{{ versionDiffStats.removed }}
              <template v-if="!versionDiffShowOnlyChanges">
                / ={{ versionDiffStats.unchanged }}
              </template>
            </span>
          </n-space>
          <n-space :size="8" :wrap="true" class="version-diff-actions">
            <n-switch
              v-model:value="versionDiffShowOnlyChanges"
              @update:value="handleVersionDiffModeChange"
            >
              <template #checked>只看变更行</template>
              <template #unchecked>显示上下文</template>
            </n-switch>
            <n-button size="small" tertiary @click="handleCopyVersionDiff">
              复制差异
            </n-button>
            <n-button size="small" tertiary @click="handleDownloadVersionDiff">
              下载 TXT
            </n-button>
          </n-space>
        </n-space>
        <pre class="version-diff-content">{{ versionDiffText }}</pre>
      </n-space>
    </n-modal>

    <n-modal
      v-model:show="showTemplatePreviewModal"
      preset="card"
      :title="currentPreviewTemplate?.name || '文书预览'"
      style="width: min(1080px, 94vw)"
      :mask-closable="true"
      @after-leave="resetTemplatePreviewState"
    >
      <n-space vertical :size="12">
        <div class="template-preview-meta">
          <div>分类：{{ currentPreviewTemplate ? getCategoryLabel(currentPreviewTemplate.category) : '-' }}</div>
          <div>路径：{{ currentPreviewTemplate?.subject || '未填写' }}</div>
          <div>
            更新时间：{{
              currentPreviewTemplate?.updatedAt
                ? formatDateTimeLabel(currentPreviewTemplate.updatedAt)
                : '-'
            }}
          </div>
        </div>
        <pre class="template-preview-content">
{{ currentPreviewTemplate?.content || '暂无可预览内容。你可以点“编辑”补充内容摘要，后续可在此直接查看。' }}
        </pre>
      </n-space>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useMessage, type FormInst, type FormRules } from 'naive-ui'
import MarkdownWorkspace from '@/components/MarkdownWorkspace.vue'
import { templateApi, type TemplatePayload } from '@/api'

interface TemplateItem {
  id: string
  name: string
  subject: string
  content: string
  category: string
  createdAt: string
  updatedAt: string
}

interface LocalImportFileEntry {
  key: string
  file: File
  relativePath: string
  extension: string
  extensionText: string
  isTextFile: boolean
}

const IMPORT_ACCEPT_ATTR = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.txt'
const SUPPORTED_IMPORT_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.md',
  '.txt',
])
const TEXT_IMPORT_EXTENSIONS = new Set(['.md', '.txt'])
const MAX_LOCAL_IMPORT_FILE_COUNT = 200
const MAX_TEXT_PREVIEW_BYTES = 1024 * 1024
const MAX_TEXT_PREVIEW_LENGTH = 3000
const ONLINE_DRAFT_STORAGE_KEY = 'template-online-editor-drafts'
const ONLINE_VERSION_STORAGE_KEY = 'template-online-editor-versions'
const ONLINE_EDITOR_NEW_KEY = 'NEW_ONLINE_DOC'
const AUTO_SAVE_INTERVAL_MS = 30 * 1000
const MAX_ONLINE_VERSION_COUNT = 20

const CATEGORIES = [
  { value: 'ONLINE_DOC', label: '在线文书' },
  { value: 'RESUME', label: '简历' },
  { value: 'TRANSCRIPT', label: '成绩单' },
  { value: 'PERSONAL_STATEMENT', label: '个人陈述' },
  { value: 'RECOMMENDATION', label: '推荐信' },
  { value: 'CERTIFICATE', label: '证书/奖项' },
  { value: 'EMAIL', label: '邮件稿' },
  { value: 'OTHER_DOC', label: '其他文书' },
] as const

const LEGACY_CATEGORY_LABEL_MAP: Record<string, string> = {
  FIRST_CONTACT: '邮件-初次联系',
  FOLLOW_UP: '邮件-跟进',
  THANK_YOU: '邮件-致谢',
  OTHER: '邮件-其他',
}

type DocumentCategory = (typeof CATEGORIES)[number]['value']
type CategoryFilter = 'ALL' | DocumentCategory

interface TemplateFormModel {
  name: string
  category: DocumentCategory
  subject: string
  content: string
}

interface OnlineEditorFormModel {
  name: string
  category: DocumentCategory
  subject: string
  content: string
}

interface OnlineEditorDraftEntry {
  form: OnlineEditorFormModel
  updatedAt: string
}

interface OnlineEditorVersionEntry {
  id: string
  form: OnlineEditorFormModel
  savedAt: string
}

interface VersionDiffStats {
  added: number
  removed: number
  unchanged: number
}

const message = useMessage()
const loading = ref(false)
const saving = ref(false)
const editorSaving = ref(false)
const importing = ref(false)
const showModal = ref(false)
const showImportModal = ref(false)
const showEditorModal = ref(false)
const autoSaveStatusText = ref('自动保存未启动')
const draftUpdatedAtLabel = ref('')
const versionOptions = ref<Array<{ label: string; value: string }>>([])
const selectedVersionId = ref<string | null>(null)
const autoSaveTimer = ref<number | null>(null)
const showVersionDiffModal = ref(false)
const versionDiffHint = ref('当前版本与所选历史版本差异')
const versionDiffText = ref('请选择历史版本后查看差异')
const versionDiffShowOnlyChanges = ref(true)
const showTemplatePreviewModal = ref(false)
const currentPreviewTemplate = ref<TemplateItem | null>(null)
const versionDiffBaseForm = ref<OnlineEditorFormModel | null>(null)
const versionDiffCurrentForm = ref<OnlineEditorFormModel | null>(null)
const versionDiffStats = ref<VersionDiffStats>({
  added: 0,
  removed: 0,
  unchanged: 0,
})
const templateList = ref<TemplateItem[]>([])
const activeCategory = ref<CategoryFilter>('ALL')
const editingTemplateId = ref<string | null>(null)
const editingOnlineTemplateId = ref<string | null>(null)
const formRef = ref<FormInst | null>(null)
const editorFormRef = ref<FormInst | null>(null)

const formModel = ref<TemplateFormModel>({
  name: '',
  category: 'RESUME',
  subject: '',
  content: '',
})

const importFileInputRef = ref<HTMLInputElement | null>(null)
const importFolderInputRef = ref<HTMLInputElement | null>(null)
const selectedImportFiles = ref<LocalImportFileEntry[]>([])
const unsupportedImportCount = ref(0)

const editorForm = ref<OnlineEditorFormModel>({
  name: '',
  category: 'ONLINE_DOC',
  subject: '',
  content: '',
})

const categoryOptions = CATEGORIES.map((item) => ({
  label: item.label,
  value: item.value,
}))

const modalTitle = ref('新建文书资料')
const editorModalTitle = ref('在线新建文书')

const categorySet = new Set<DocumentCategory>(
  CATEGORIES.map((item) => item.value)
)

const formRules: FormRules = {
  name: [
    { required: true, message: '请输入文书名称', trigger: ['blur', 'input'] },
    {
      validator: (_rule, value: string) => value.trim().length > 0,
      message: '文书名称不能为空',
      trigger: ['blur', 'input'],
    },
  ],
  category: [
    { required: true, message: '请选择文书类型', trigger: ['change', 'blur'] },
    {
      validator: (_rule, value: string) => categorySet.has(value as DocumentCategory),
      message: '文书类型不合法',
      trigger: ['change', 'blur'],
    },
  ],
}

const editorFormRules: FormRules = {
  name: [
    { required: true, message: '请输入文书名称', trigger: ['blur', 'input'] },
    {
      validator: (_rule, value: string) => value.trim().length > 0,
      message: '文书名称不能为空',
      trigger: ['blur', 'input'],
    },
  ],
  category: [
    { required: true, message: '请选择文书类型', trigger: ['change', 'blur'] },
    {
      validator: (_rule, value: string) => categorySet.has(value as DocumentCategory),
      message: '文书类型不合法',
      trigger: ['change', 'blur'],
    },
  ],
  content: [
    { required: true, message: '请输入正文内容', trigger: ['blur', 'input'] },
    {
      validator: (_rule, value: string) => value.trim().length > 0,
      message: '正文内容不能为空',
      trigger: ['blur', 'input'],
    },
  ],
}

/**
 * @description 提取接口错误信息。
 * @param error 错误对象
 * @param fallback 兜底文案
 * @returns 错误文案
 */
function getApiErrorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback
}

/**
 * @description 判断字符串是否 HTTP/HTTPS 链接。
 * @param value 文本
 * @returns 是否 HTTP 链接
 */
function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

/**
 * @description 判断是否为合法文书类型。
 * @param value 分类值
 * @returns 是否合法
 */
function isDocumentCategory(value: string): value is DocumentCategory {
  return categorySet.has(value as DocumentCategory)
}

/**
 * @description 归一化文书类型。
 * @param value 分类值
 * @returns 合法分类
 */
function normalizeCategory(value: string): DocumentCategory {
  if (isDocumentCategory(value)) {
    return value
  }
  return 'OTHER_DOC'
}

/**
 * @description 根据分类值获取中文标签。
 * @param category 分类值
 * @returns 中文名称
 */
function getCategoryLabel(category: string): string {
  const current = CATEGORIES.find((item) => item.value === category)
  if (current) {
    return current.label
  }
  return LEGACY_CATEGORY_LABEL_MAP[category] || '其他文书'
}

/**
 * @description 复制在线编辑表单，避免引用共享。
 * @param source 源表单
 * @returns 新对象
 */
function cloneOnlineEditorForm(source: OnlineEditorFormModel): OnlineEditorFormModel {
  return {
    name: source.name,
    category: source.category,
    subject: source.subject,
    content: source.content,
  }
}

/**
 * @description 将未知对象转换为在线编辑表单。
 * @param raw 未知输入
 * @returns 表单模型
 */
function toOnlineEditorFormModel(raw: unknown): OnlineEditorFormModel {
  const value = (raw || {}) as Partial<OnlineEditorFormModel>
  return {
    name: typeof value.name === 'string' ? value.name : '',
    category: normalizeCategory(typeof value.category === 'string' ? value.category : 'ONLINE_DOC'),
    subject: typeof value.subject === 'string' ? value.subject : '',
    content: typeof value.content === 'string' ? value.content : '',
  }
}

/**
 * @description 构建在线编辑本地缓存键。
 * @returns 当前缓存键
 */
function getCurrentEditorKey(): string {
  return editingOnlineTemplateId.value || ONLINE_EDITOR_NEW_KEY
}

/**
 * @description 格式化本地时间文案。
 * @param value ISO 时间
 * @returns 格式化后的文本
 */
function formatDateTimeLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString('zh-CN', { hour12: false })
}

/**
 * @description 从 localStorage 读取记录对象。
 * @param key 存储键
 * @returns 记录对象
 */
function readStorageRecord<T>(key: string): Record<string, T> {
  if (typeof window === 'undefined') {
    return {}
  }
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    return parsed as Record<string, T>
  } catch {
    return {}
  }
}

/**
 * @description 写入 localStorage 记录对象。
 * @param key 存储键
 * @param value 记录对象
 * @returns 是否写入成功
 */
function writeStorageRecord<T>(key: string, value: Record<string, T>): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/**
 * @description 同步历史版本下拉选项。
 */
function refreshVersionOptions() {
  const key = getCurrentEditorKey()
  const store = readStorageRecord<OnlineEditorVersionEntry[]>(ONLINE_VERSION_STORAGE_KEY)
  const list = Array.isArray(store[key]) ? store[key] : []
  versionOptions.value = list.map((item) => ({
    label: `${item.form.name || '未命名文书'}（${formatDateTimeLabel(item.savedAt) || item.savedAt}）`,
    value: item.id,
  }))

  if (
    selectedVersionId.value &&
    !versionOptions.value.some((item) => item.value === selectedVersionId.value)
  ) {
    selectedVersionId.value = null
  }
}

/**
 * @description 获取当前编辑器键对应的历史版本列表。
 * @returns 历史版本数组
 */
function getCurrentVersionList(): OnlineEditorVersionEntry[] {
  const key = getCurrentEditorKey()
  const store = readStorageRecord<OnlineEditorVersionEntry[]>(ONLINE_VERSION_STORAGE_KEY)
  return Array.isArray(store[key]) ? store[key] : []
}

/**
 * @description 获取当前选中的历史版本对象。
 * @returns 选中版本或 null
 */
function getSelectedVersionEntry(): OnlineEditorVersionEntry | null {
  const versionId = selectedVersionId.value
  if (!versionId) {
    return null
  }
  const list = getCurrentVersionList()
  const matched = list.find((item) => item.id === versionId)
  return matched || null
}

/**
 * @description 使用简化策略生成行差异文本。
 * @param baseLines 历史版本行
 * @param currentLines 当前行
 * @param showOnlyChanges 是否仅显示变更行
 * @returns 差异文本
 */
function buildQuickLineDiff(
  baseLines: string[],
  currentLines: string[],
  showOnlyChanges: boolean
): string {
  const result: string[] = []
  const maxLineCount = Math.max(baseLines.length, currentLines.length)
  const maxOutputLines = 300

  for (let index = 0; index < maxLineCount; index += 1) {
    const beforeLine = baseLines[index]
    const afterLine = currentLines[index]

    if (beforeLine === afterLine) {
      if (!showOnlyChanges && beforeLine !== undefined) {
        result.push(`  ${beforeLine}`)
      }
      continue
    }

    if (beforeLine !== undefined) {
      result.push(`- ${beforeLine}`)
    }
    if (afterLine !== undefined) {
      result.push(`+ ${afterLine}`)
    }

    if (result.length >= maxOutputLines) {
      result.push('...（差异内容较长，已截断显示）')
      break
    }
  }

  if (result.length === 0) {
    return '当前内容与该历史版本一致。'
  }
  return result.join('\n')
}

/**
 * @description 生成统一格式的正文差异文本。
 * @param baseText 历史版本正文
 * @param currentText 当前正文
 * @param showOnlyChanges 是否仅显示变更行
 * @returns 差异文本
 */
function buildUnifiedLineDiff(
  baseText: string,
  currentText: string,
  showOnlyChanges: boolean
): string {
  const normalizedBase = baseText || ''
  const normalizedCurrent = currentText || ''
  if (normalizedBase === normalizedCurrent) {
    return '当前内容与该历史版本一致。'
  }

  const baseLines = normalizedBase.split(/\r?\n/)
  const currentLines = normalizedCurrent.split(/\r?\n/)
  const matrixSize = baseLines.length * currentLines.length

  if (matrixSize > 200000) {
    return buildQuickLineDiff(baseLines, currentLines, showOnlyChanges)
  }

  const lcs: Uint32Array[] = Array.from(
    { length: baseLines.length + 1 },
    () => new Uint32Array(currentLines.length + 1)
  )

  for (let i = baseLines.length - 1; i >= 0; i -= 1) {
    for (let j = currentLines.length - 1; j >= 0; j -= 1) {
      if (baseLines[i] === currentLines[j]) {
        lcs[i][j] = lcs[i + 1][j + 1] + 1
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1])
      }
    }
  }

  const result: string[] = []
  let i = 0
  let j = 0
  while (i < baseLines.length && j < currentLines.length) {
    if (baseLines[i] === currentLines[j]) {
      if (!showOnlyChanges) {
        result.push(`  ${baseLines[i]}`)
      }
      i += 1
      j += 1
      continue
    }
    if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      result.push(`- ${baseLines[i]}`)
      i += 1
    } else {
      result.push(`+ ${currentLines[j]}`)
      j += 1
    }
  }

  while (i < baseLines.length) {
    result.push(`- ${baseLines[i]}`)
    i += 1
  }
  while (j < currentLines.length) {
    result.push(`+ ${currentLines[j]}`)
    j += 1
  }

  const output = result.join('\n')
  if (!output.trim()) {
    return '当前内容与该历史版本一致。'
  }
  return output
}

/**
 * @description 构建文书基础信息差异文本。
 * @param baseForm 历史版本表单
 * @param currentForm 当前表单
 * @returns 差异行数组
 */
function buildMetadataDiffLines(
  baseForm: OnlineEditorFormModel,
  currentForm: OnlineEditorFormModel
): string[] {
  const lines: string[] = []
  const baseCategoryLabel = getCategoryLabel(baseForm.category)
  const currentCategoryLabel = getCategoryLabel(currentForm.category)

  if (baseForm.name !== currentForm.name) {
    lines.push(`- 名称: ${baseForm.name || '（空）'}`)
    lines.push(`+ 名称: ${currentForm.name || '（空）'}`)
  }
  if (baseCategoryLabel !== currentCategoryLabel) {
    lines.push(`- 类型: ${baseCategoryLabel}`)
    lines.push(`+ 类型: ${currentCategoryLabel}`)
  }
  if (baseForm.subject !== currentForm.subject) {
    lines.push(`- 路径/链接: ${baseForm.subject || '（空）'}`)
    lines.push(`+ 路径/链接: ${currentForm.subject || '（空）'}`)
  }

  return lines
}

/**
 * @description 统计差异结果中的新增/删除/上下文行数量。
 * @param lines 差异行
 * @returns 统计结果
 */
function countDiffStats(lines: string[]): VersionDiffStats {
  const stats: VersionDiffStats = {
    added: 0,
    removed: 0,
    unchanged: 0,
  }

  for (const line of lines) {
    if (line.startsWith('+ ')) {
      stats.added += 1
      continue
    }
    if (line.startsWith('- ')) {
      stats.removed += 1
      continue
    }
    if (line.startsWith('  ')) {
      stats.unchanged += 1
    }
  }

  return stats
}

/**
 * @description 刷新历史版本差异文本。
 */
function refreshVersionDiffText() {
  const baseForm = versionDiffBaseForm.value
  const currentForm = versionDiffCurrentForm.value
  if (!baseForm || !currentForm) {
    versionDiffText.value = '请选择历史版本后查看差异'
    versionDiffStats.value = { added: 0, removed: 0, unchanged: 0 }
    return
  }

  const metadataDiffLines = buildMetadataDiffLines(baseForm, currentForm)
  const contentDiff = buildUnifiedLineDiff(
    baseForm.content,
    currentForm.content,
    versionDiffShowOnlyChanges.value
  )
  const sections: string[] = []

  if (metadataDiffLines.length > 0) {
    sections.push('[基础信息差异]')
    sections.push(...metadataDiffLines)
    sections.push('')
  } else if (!versionDiffShowOnlyChanges.value) {
    sections.push('[基础信息差异]')
    sections.push('  （无变化）')
    sections.push('')
  }

  sections.push('[正文差异]')
  sections.push(contentDiff)
  versionDiffText.value = sections.join('\n')

  const contentDiffLines = contentDiff.split('\n')
  const stats = countDiffStats([...metadataDiffLines, ...contentDiffLines])
  versionDiffStats.value = stats
}

/**
 * @description 处理差异显示模式切换。
 */
function handleVersionDiffModeChange() {
  if (!showVersionDiffModal.value) {
    return
  }
  refreshVersionDiffText()
}

/**
 * @description 组装可复制/下载的差异文本。
 * @returns 导出文本
 */
function buildVersionDiffExportContent(): string {
  const modeText = versionDiffShowOnlyChanges.value ? '仅变更行' : '完整上下文'
  const stats = versionDiffStats.value
  return [
    `# ${versionDiffHint.value}`,
    `# 显示模式: ${modeText}`,
    `# 统计: +${stats.added} / -${stats.removed} / =${stats.unchanged}`,
    '',
    versionDiffText.value,
  ].join('\n')
}

/**
 * @description 复制差异文本到剪贴板。
 */
async function handleCopyVersionDiff() {
  const content = buildVersionDiffExportContent().trim()
  if (!content) {
    message.info('当前没有可复制的差异内容')
    return
  }

  if (!navigator.clipboard) {
    message.error('当前环境不支持剪贴板复制')
    return
  }

  try {
    await navigator.clipboard.writeText(content)
    message.success('差异内容已复制')
  } catch {
    message.error('复制失败，请检查浏览器权限')
  }
}

/**
 * @description 下载差异文本为 TXT 文件。
 */
function handleDownloadVersionDiff() {
  const content = buildVersionDiffExportContent().trim()
  if (!content) {
    message.info('当前没有可下载的差异内容')
    return
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `文书差异-${timestamp}.txt`
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(url)
  message.success('差异文本已下载')
}

/**
 * @description 打开历史版本差异查看弹窗。
 */
function handleOpenVersionDiff() {
  const selectedVersion = getSelectedVersionEntry()
  if (!selectedVersion) {
    message.warning('请先选择有效的历史版本')
    return
  }

  versionDiffBaseForm.value = cloneOnlineEditorForm(selectedVersion.form)
  versionDiffCurrentForm.value = cloneOnlineEditorForm(editorForm.value)
  const selectedAt = formatDateTimeLabel(selectedVersion.savedAt) || selectedVersion.savedAt
  versionDiffHint.value = `对比基线：${selectedVersion.form.name || '未命名文书'}（${selectedAt}）`
  refreshVersionDiffText()
  showVersionDiffModal.value = true
}

/**
 * @description 删除指定键对应的草稿。
 * @param key 草稿键
 * @returns 是否删除
 */
function clearDraftByKey(key: string): boolean {
  const store = readStorageRecord<OnlineEditorDraftEntry>(ONLINE_DRAFT_STORAGE_KEY)
  if (!store[key]) {
    return false
  }
  delete store[key]
  return writeStorageRecord(ONLINE_DRAFT_STORAGE_KEY, store)
}

/**
 * @description 清空当前在线编辑草稿。
 * @param notify 是否提示
 * @returns 是否删除成功
 */
function clearCurrentDraft(notify = false): boolean {
  const success = clearDraftByKey(getCurrentEditorKey())
  draftUpdatedAtLabel.value = ''
  autoSaveStatusText.value = success ? '草稿已清空' : '当前没有草稿'
  if (notify) {
    if (success) {
      message.success('草稿已清空')
    } else {
      message.info('当前没有可清空草稿')
    }
  }
  return success
}

/**
 * @description 保存当前在线编辑草稿到本地。
 * @param notify 是否提示
 * @returns 是否保存成功
 */
function saveCurrentDraft(notify = false): boolean {
  const key = getCurrentEditorKey()
  const form = cloneOnlineEditorForm(editorForm.value)
  const hasDraftContent = Boolean(
    form.name.trim() ||
    form.subject.trim() ||
    form.content.trim()
  )

  if (!hasDraftContent) {
    clearDraftByKey(key)
    draftUpdatedAtLabel.value = ''
    autoSaveStatusText.value = '内容为空，未保存草稿'
    if (notify) {
      message.info('当前内容为空，未生成草稿')
    }
    return false
  }

  const updatedAt = new Date().toISOString()
  const store = readStorageRecord<OnlineEditorDraftEntry>(ONLINE_DRAFT_STORAGE_KEY)
  store[key] = {
    form,
    updatedAt,
  }

  if (!writeStorageRecord(ONLINE_DRAFT_STORAGE_KEY, store)) {
    autoSaveStatusText.value = '草稿保存失败（本地存储不可用）'
    if (notify) {
      message.error('草稿保存失败，请检查浏览器本地存储权限')
    }
    return false
  }

  draftUpdatedAtLabel.value = formatDateTimeLabel(updatedAt)
  autoSaveStatusText.value = '草稿已自动保存'
  if (notify) {
    message.success('草稿保存成功')
  }
  return true
}

/**
 * @description 尝试恢复当前草稿。
 * @param notify 是否提示
 * @returns 是否恢复成功
 */
function tryRestoreCurrentDraft(notify = false): boolean {
  const key = getCurrentEditorKey()
  const store = readStorageRecord<OnlineEditorDraftEntry>(ONLINE_DRAFT_STORAGE_KEY)
  const entry = store[key]
  if (!entry) {
    if (notify) {
      message.info('没有可恢复的草稿')
    }
    return false
  }

  editorForm.value = toOnlineEditorFormModel(entry.form)
  draftUpdatedAtLabel.value = formatDateTimeLabel(entry.updatedAt)
  autoSaveStatusText.value = '已恢复本地草稿'
  if (notify) {
    message.success('已恢复本地草稿')
  }
  return true
}

/**
 * @description 合并并迁移本地草稿/版本键。
 * @param fromKey 旧键
 * @param toKey 新键
 */
function migrateEditorStorageKey(fromKey: string, toKey: string) {
  if (!fromKey || !toKey || fromKey === toKey) {
    return
  }

  const draftStore = readStorageRecord<OnlineEditorDraftEntry>(ONLINE_DRAFT_STORAGE_KEY)
  if (draftStore[fromKey] && !draftStore[toKey]) {
    draftStore[toKey] = draftStore[fromKey]
  }
  if (draftStore[fromKey]) {
    delete draftStore[fromKey]
    writeStorageRecord(ONLINE_DRAFT_STORAGE_KEY, draftStore)
  }

  const versionStore = readStorageRecord<OnlineEditorVersionEntry[]>(ONLINE_VERSION_STORAGE_KEY)
  const fromList = Array.isArray(versionStore[fromKey]) ? versionStore[fromKey] : []
  if (fromList.length === 0) {
    return
  }
  const toList = Array.isArray(versionStore[toKey]) ? versionStore[toKey] : []
  const merged = [...fromList, ...toList]
    .sort((left, right) => {
      const leftTime = new Date(left.savedAt).getTime()
      const rightTime = new Date(right.savedAt).getTime()
      return rightTime - leftTime
    })
    .slice(0, MAX_ONLINE_VERSION_COUNT)
  versionStore[toKey] = merged
  delete versionStore[fromKey]
  writeStorageRecord(ONLINE_VERSION_STORAGE_KEY, versionStore)
}

/**
 * @description 写入当前内容到历史版本。
 * @param targetKey 目标缓存键
 * @returns 是否成功
 */
function pushCurrentVersionSnapshot(targetKey = getCurrentEditorKey()): boolean {
  const payload = buildOnlineEditorPayload()
  if (!payload) {
    return false
  }

  const store = readStorageRecord<OnlineEditorVersionEntry[]>(ONLINE_VERSION_STORAGE_KEY)
  const list = Array.isArray(store[targetKey]) ? store[targetKey] : []
  const entry: OnlineEditorVersionEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    form: {
      name: payload.name,
      category: normalizeCategory(typeof payload.category === 'string' ? payload.category : 'ONLINE_DOC'),
      subject: payload.subject || '',
      content: payload.content || '',
    },
    savedAt: new Date().toISOString(),
  }

  store[targetKey] = [entry, ...list].slice(0, MAX_ONLINE_VERSION_COUNT)
  if (!writeStorageRecord(ONLINE_VERSION_STORAGE_KEY, store)) {
    return false
  }

  refreshVersionOptions()
  selectedVersionId.value = entry.id
  return true
}

/**
 * @description 回滚到所选历史版本。
 */
function handleRollbackSelectedVersion() {
  const versionId = selectedVersionId.value
  if (!versionId) {
    message.warning('请先选择要回滚的历史版本')
    return
  }

  const key = getCurrentEditorKey()
  const store = readStorageRecord<OnlineEditorVersionEntry[]>(ONLINE_VERSION_STORAGE_KEY)
  const list = Array.isArray(store[key]) ? store[key] : []
  const matched = list.find((item) => item.id === versionId)

  if (!matched) {
    message.warning('所选版本不存在或已过期')
    refreshVersionOptions()
    return
  }

  editorForm.value = toOnlineEditorFormModel(matched.form)
  autoSaveStatusText.value = '已回滚到历史版本'
  draftUpdatedAtLabel.value = formatDateTimeLabel(matched.savedAt)
  saveCurrentDraft(false)
  message.success('已回滚到所选版本')
}

/**
 * @description 启动自动保存。
 */
function startAutoSaveLoop() {
  stopAutoSaveLoop()
  autoSaveStatusText.value = '自动保存已启动'
  autoSaveTimer.value = window.setInterval(() => {
    if (!showEditorModal.value || editorSaving.value) {
      return
    }
    saveCurrentDraft(false)
  }, AUTO_SAVE_INTERVAL_MS)
}

/**
 * @description 停止自动保存。
 */
function stopAutoSaveLoop() {
  if (autoSaveTimer.value === null) {
    return
  }
  window.clearInterval(autoSaveTimer.value)
  autoSaveTimer.value = null
}

/**
 * @description 手动保存草稿。
 */
function handleManualSaveDraft() {
  saveCurrentDraft(true)
}

/**
 * @description 手动恢复草稿。
 */
function handleRestoreDraft() {
  tryRestoreCurrentDraft(true)
}

/**
 * @description 手动清空草稿。
 */
function handleClearDraft() {
  clearCurrentDraft(true)
}

/**
 * @description 重置资料表单。
 */
function resetForm() {
  formModel.value = {
    name: '',
    category: 'RESUME',
    subject: '',
    content: '',
  }
}

/**
 * @description 重置在线编辑器表单。
 */
function resetEditorForm() {
  editorForm.value = {
    name: '',
    category: 'ONLINE_DOC',
    subject: '',
    content: '',
  }
}

/**
 * @description 重置本地导入选择状态。
 */
function resetImportSelection() {
  selectedImportFiles.value = []
  unsupportedImportCount.value = 0
}

/**
 * @description 弹窗关闭后重置状态与校验信息。
 */
function resetModalState() {
  modalTitle.value = '新建文书资料'
  editingTemplateId.value = null
  formRef.value?.restoreValidation()
  resetForm()
}

/**
 * @description 在线编辑弹窗关闭后重置状态。
 */
function resetEditorModalState() {
  stopAutoSaveLoop()
  editorModalTitle.value = '在线新建文书'
  editingOnlineTemplateId.value = null
  showVersionDiffModal.value = false
  versionDiffHint.value = '当前版本与所选历史版本差异'
  versionDiffText.value = '请选择历史版本后查看差异'
  versionDiffShowOnlyChanges.value = true
  versionDiffBaseForm.value = null
  versionDiffCurrentForm.value = null
  versionDiffStats.value = { added: 0, removed: 0, unchanged: 0 }
  autoSaveStatusText.value = '自动保存未启动'
  draftUpdatedAtLabel.value = ''
  versionOptions.value = []
  selectedVersionId.value = null
  editorFormRef.value?.restoreValidation()
  resetEditorForm()
}

/**
 * @description 导入弹窗关闭后重置状态。
 */
function resetImportModalState() {
  resetImportSelection()
}

/**
 * @description 文书预览弹窗关闭后重置状态。
 */
function resetTemplatePreviewState() {
  currentPreviewTemplate.value = null
}

/**
 * @description 根据分类加载文书资料列表。
 */
async function fetchTemplateList() {
  loading.value = true

  try {
    const params = activeCategory.value === 'ALL'
      ? undefined
      : { category: activeCategory.value }
    const response = await templateApi.list(params)
    const list = (response.data as { data?: unknown }).data
    templateList.value = Array.isArray(list) ? (list as TemplateItem[]) : []
  } catch (error) {
    message.error(getApiErrorMessage(error, '获取文书资料失败'))
  } finally {
    loading.value = false
  }
}

/**
 * @description 切换分类筛选并刷新列表。
 * @param value 分类值
 */
function handleCategoryChange(value: string | number) {
  if (typeof value !== 'string') {
    return
  }

  activeCategory.value = value as CategoryFilter
  void fetchTemplateList()
}

/**
 * @description 打开新建弹窗。
 */
function handleOpenCreateModal() {
  modalTitle.value = '新建文书资料'
  editingTemplateId.value = null
  formRef.value?.restoreValidation()
  resetForm()
  showModal.value = true
}

/**
 * @description 打开在线新建弹窗。
 */
function handleOpenOnlineCreateModal() {
  editorModalTitle.value = '在线新建文书'
  editingOnlineTemplateId.value = null
  editorFormRef.value?.restoreValidation()
  resetEditorForm()
  selectedVersionId.value = null
  showEditorModal.value = true
  refreshVersionOptions()
  tryRestoreCurrentDraft(false)
  startAutoSaveLoop()
}

/**
 * @description 打开导入弹窗。
 */
function handleOpenImportModal() {
  resetImportSelection()
  showImportModal.value = true
}

/**
 * @description 触发本地文件选择器。
 */
function handlePickImportFiles() {
  importFileInputRef.value?.click()
}

/**
 * @description 触发本地文件夹选择器。
 */
function handlePickImportFolder() {
  importFolderInputRef.value?.click()
}

/**
 * @description 获取文件扩展名（含点，且为小写）。
 * @param fileName 文件名
 * @returns 扩展名
 */
function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.')
  if (index < 0) {
    return ''
  }
  return fileName.slice(index).toLowerCase()
}

/**
 * @description 获取文件名（去掉扩展名）。
 * @param fileName 文件名
 * @returns 基础名称
 */
function getBaseFileName(fileName: string): string {
  const extension = getFileExtension(fileName)
  if (!extension) {
    return fileName.trim() || '未命名文书'
  }
  const baseName = fileName.slice(0, fileName.length - extension.length).trim()
  return baseName || '未命名文书'
}

/**
 * @description 判断扩展名是否支持导入。
 * @param extension 扩展名
 * @returns 是否支持
 */
function isSupportedImportExtension(extension: string): boolean {
  return SUPPORTED_IMPORT_EXTENSIONS.has(extension)
}

/**
 * @description 规范化浏览器返回的相对路径。
 * @param file 文件对象
 * @returns 相对路径
 */
function normalizeImportRelativePath(file: File): string {
  const browserFile = file as File & { webkitRelativePath?: string }
  const relativePath = browserFile.webkitRelativePath || file.name
  return relativePath.replace(/\\/g, '/').replace(/^\/+/, '').trim()
}

/**
 * @description 规范化导入后存储的“路径”字段。
 * @param relativePath 相对路径
 * @returns 路径文本
 */
function normalizeImportSubject(relativePath: string): string {
  return `本地文件/${relativePath}`
}

/**
 * @description 推断文书分类。
 * @param pathText 路径或文件名文本
 * @returns 文书分类
 */
function inferImportCategory(pathText: string): DocumentCategory {
  const lowerPath = pathText.toLowerCase()

  if (lowerPath.includes('简历') || lowerPath.includes('resume') || lowerPath.includes('cv')) {
    return 'RESUME'
  }
  if (lowerPath.includes('成绩单') || lowerPath.includes('transcript') || lowerPath.includes('grade')) {
    return 'TRANSCRIPT'
  }
  if (
    lowerPath.includes('个人陈述') ||
    lowerPath.includes('personal statement') ||
    lowerPath.includes('statement')
  ) {
    return 'PERSONAL_STATEMENT'
  }
  if (lowerPath.includes('推荐信') || lowerPath.includes('recommendation')) {
    return 'RECOMMENDATION'
  }
  if (
    lowerPath.includes('证书') ||
    lowerPath.includes('奖项') ||
    lowerPath.includes('certificate') ||
    lowerPath.includes('award')
  ) {
    return 'CERTIFICATE'
  }
  return 'OTHER_DOC'
}

/**
 * @description 格式化文件体积。
 * @param bytes 字节数
 * @returns 体积文案
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * @description 构建本地导入条目。
 * @param file 文件对象
 * @returns 导入条目，若格式不支持返回 null
 */
function buildLocalImportEntry(file: File): LocalImportFileEntry | null {
  const extension = getFileExtension(file.name)
  if (!isSupportedImportExtension(extension)) {
    return null
  }
  const relativePath = normalizeImportRelativePath(file)
  const key = `${relativePath.toLowerCase()}::${file.size}::${file.lastModified}`
  return {
    key,
    file,
    relativePath,
    extension,
    extensionText: extension ? extension.slice(1).toUpperCase() : '未知',
    isTextFile: TEXT_IMPORT_EXTENSIONS.has(extension),
  }
}

/**
 * @description 追加选择的本地文件。
 * @param fileList 文件列表
 */
function appendSelectedImportFiles(fileList: FileList | null) {
  if (!fileList || fileList.length === 0) {
    return
  }

  const entryMap = new Map<string, LocalImportFileEntry>(
    selectedImportFiles.value.map((item) => [item.key, item])
  )
  let unsupportedCount = 0

  for (const file of Array.from(fileList)) {
    const entry = buildLocalImportEntry(file)
    if (!entry) {
      unsupportedCount += 1
      continue
    }
    entryMap.set(entry.key, entry)
  }

  let mergedList = Array.from(entryMap.values())
  if (mergedList.length > MAX_LOCAL_IMPORT_FILE_COUNT) {
    mergedList = mergedList.slice(0, MAX_LOCAL_IMPORT_FILE_COUNT)
    message.warning(`单次最多导入 ${MAX_LOCAL_IMPORT_FILE_COUNT} 个文件，超出部分已忽略`)
  }

  selectedImportFiles.value = mergedList
  unsupportedImportCount.value += unsupportedCount
}

/**
 * @description 文件选择器变化事件处理。
 * @param event 事件对象
 */
function handleImportFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement | null
  appendSelectedImportFiles(input?.files || null)
  if (input) {
    input.value = ''
  }
}

/**
 * @description 文件夹选择器变化事件处理。
 * @param event 事件对象
 */
function handleImportFolderSelected(event: Event) {
  const input = event.target as HTMLInputElement | null
  appendSelectedImportFiles(input?.files || null)
  if (input) {
    input.value = ''
  }
}

/**
 * @description 清空当前已选导入文件。
 */
function clearSelectedImportFiles() {
  resetImportSelection()
}

/**
 * @description 生成本地导入时的内容摘要。
 * @param entry 导入条目
 * @returns 摘要文本
 */
async function buildLocalImportContent(entry: LocalImportFileEntry): Promise<string> {
  const headerLines = [
    `来源文件：${entry.relativePath}`,
    `文件类型：${entry.extensionText}`,
    `文件大小：${formatFileSize(entry.file.size)}`,
  ]

  if (!entry.isTextFile) {
    return `${headerLines.join('\n')}\n\n该文件为二进制文档，请在本地应用中打开原文件查看完整内容。`
  }

  if (entry.file.size > MAX_TEXT_PREVIEW_BYTES) {
    return `${headerLines.join('\n')}\n\n文本文件较大，已跳过全文读取，请在本地打开原文件查看。`
  }

  try {
    const rawText = await entry.file.text()
    const trimmed = rawText.trim()
    if (!trimmed) {
      return `${headerLines.join('\n')}\n\n文件内容为空。`
    }
    const preview = trimmed.length > MAX_TEXT_PREVIEW_LENGTH
      ? `${trimmed.slice(0, MAX_TEXT_PREVIEW_LENGTH)}\n...(内容已截断)`
      : trimmed
    return `${headerLines.join('\n')}\n\n${preview}`
  } catch {
    return `${headerLines.join('\n')}\n\n内容读取失败，请在本地打开原文件查看。`
  }
}

/**
 * @description 构建本地导入提交载荷。
 * @param entry 导入条目
 * @param subject 归一化后的路径文本
 * @returns 提交载荷
 */
async function buildLocalImportPayload(
  entry: LocalImportFileEntry,
  subject: string
): Promise<TemplatePayload> {
  const fileName = getBaseFileName(entry.file.name).slice(0, 60)
  return {
    name: fileName || '未命名文书',
    category: inferImportCategory(`${entry.relativePath} ${fileName}`),
    subject,
    content: await buildLocalImportContent(entry),
  }
}

/**
 * @description 导出文书资料到本地文件。
 */
async function handleExportLocalTemplates() {
  try {
    const response = await templateApi.list()
    const list = (response.data as { data?: unknown }).data
    const templates = Array.isArray(list) ? (list as TemplateItem[]) : []

    if (templates.length === 0) {
      message.info('暂无可导出的文书资料')
      return
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      total: templates.length,
      templates: templates.map((item) => ({
        name: item.name,
        category: item.category,
        subject: item.subject,
        content: item.content,
        updatedAt: item.updatedAt,
      })),
    }
    const content = JSON.stringify(exportData, null, 2)
    const dateText = new Date().toISOString().slice(0, 10)
    const fileName = `文书资料库-${dateText}.json`
    const saved = await saveTextFileToLocal(content, fileName, 'application/json;charset=utf-8')
    if (saved) {
      message.success('文书资料已导出到本地')
    } else {
      message.info('已取消导出')
    }
  } catch (error) {
    message.error(getApiErrorMessage(error, '导出文书资料失败'))
  }
}

/**
 * @description 将文本保存到本地文件（优先系统保存面板）。
 * @param content 文件内容
 * @param fileName 文件名
 * @param mimeType MIME 类型
 * @returns 是否保存成功
 */
async function saveTextFileToLocal(content: string, fileName: string, mimeType: string): Promise<boolean> {
  const maybeWindow = window as Window & {
    showSaveFilePicker?: (options?: unknown) => Promise<{
      createWritable: () => Promise<{
        write: (data: Blob) => Promise<void>
        close: () => Promise<void>
      }>
    }>
  }

  if (typeof maybeWindow.showSaveFilePicker === 'function') {
    try {
      const fileHandle = await maybeWindow.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: 'JSON 文件',
            accept: { 'application/json': ['.json'] },
          },
        ],
      })
      const writable = await fileHandle.createWritable()
      await writable.write(new Blob([content], { type: mimeType }))
      await writable.close()
      return true
    } catch (error) {
      const errorName = (error as { name?: string }).name
      if (errorName === 'AbortError') {
        return false
      }
    }
  }

  const blob = new Blob([content], { type: mimeType })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(url)
  return true
}

/**
 * @description 打开编辑弹窗并填充表单。
 * @param item 当前资料
 */
function handleOpenEditModal(item: TemplateItem) {
  modalTitle.value = '编辑文书资料'
  editingTemplateId.value = item.id
  formModel.value = {
    name: item.name,
    category: normalizeCategory(item.category),
    subject: item.subject || '',
    content: item.content || '',
  }
  formRef.value?.restoreValidation()
  showModal.value = true
}

/**
 * @description 打开在线编辑弹窗并填充表单。
 * @param item 当前资料
 */
function handleOpenOnlineEditModal(item: TemplateItem) {
  editorModalTitle.value = '在线编辑文书'
  editingOnlineTemplateId.value = item.id
  editorForm.value = {
    name: item.name,
    category: normalizeCategory(item.category),
    subject: item.subject || '',
    content: item.content || '',
  }
  editorFormRef.value?.restoreValidation()
  showEditorModal.value = true
  refreshVersionOptions()
  tryRestoreCurrentDraft(false)
  startAutoSaveLoop()
}

/**
 * @description 构建提交载荷。
 * @returns 载荷或 null
 */
function buildSubmitPayload(): TemplatePayload | null {
  const name = formModel.value.name.trim()
  const category = formModel.value.category
  const subject = formModel.value.subject.trim()
  const content = formModel.value.content.trim()

  if (!name) {
    return null
  }
  if (!subject && !content) {
    return null
  }

  return {
    name,
    category,
    subject,
    content,
  }
}

/**
 * @description 构建在线编辑提交载荷。
 * @returns 载荷或 null
 */
function buildOnlineEditorPayload(): TemplatePayload | null {
  const name = editorForm.value.name.trim()
  const category = editorForm.value.category
  const subject = editorForm.value.subject.trim()
  const content = editorForm.value.content.trim()

  if (!name || !content) {
    return null
  }

  return {
    name,
    category,
    subject,
    content,
  }
}

/**
 * @description 提交创建或更新请求。
 * @returns 是否成功
 */
async function handleSubmitTemplate() {
  if (saving.value) {
    return false
  }

  try {
    await formRef.value?.validate()
  } catch {
    return false
  }

  const payload = buildSubmitPayload()
  if (!payload) {
    message.warning('请填写文书名称，且“文件路径/链接”与“内容摘要”至少填写一项')
    return false
  }

  saving.value = true
  try {
    if (editingTemplateId.value) {
      await templateApi.update(editingTemplateId.value, payload)
      message.success('文书资料更新成功')
    } else {
      await templateApi.create(payload)
      message.success('文书资料创建成功')
    }

    await fetchTemplateList()
    return true
  } catch (error) {
    const fallback = editingTemplateId.value ? '更新文书资料失败' : '创建文书资料失败'
    message.error(getApiErrorMessage(error, fallback))
    return false
  } finally {
    saving.value = false
  }
}

/**
 * @description 在线保存文书内容。
 * @returns 是否成功
 */
async function handleSubmitOnlineEditor() {
  if (editorSaving.value) {
    return false
  }

  try {
    await editorFormRef.value?.validate()
  } catch {
    return false
  }

  const payload = buildOnlineEditorPayload()
  if (!payload) {
    message.warning('在线文书必须填写名称与正文内容')
    return false
  }

  editorSaving.value = true
  try {
    const sourceEditorKey = getCurrentEditorKey()
    let finalEditorKey = sourceEditorKey

    if (editingOnlineTemplateId.value) {
      await templateApi.update(editingOnlineTemplateId.value, payload)
      message.success('在线文书更新成功')
    } else {
      const response = await templateApi.create(payload)
      const createdData = (response.data as { data?: unknown }).data as { id?: unknown } | undefined
      const createdId = typeof createdData?.id === 'string' ? createdData.id.trim() : ''
      if (createdId) {
        finalEditorKey = createdId
        migrateEditorStorageKey(sourceEditorKey, finalEditorKey)
        editingOnlineTemplateId.value = finalEditorKey
      }
      message.success('在线文书创建成功')
    }

    const versionSaved = pushCurrentVersionSnapshot(finalEditorKey)
    if (!versionSaved) {
      message.warning('文书已保存，但历史版本写入失败')
    }
    clearDraftByKey(finalEditorKey)
    if (sourceEditorKey !== finalEditorKey) {
      clearDraftByKey(sourceEditorKey)
    }

    showEditorModal.value = false
    await fetchTemplateList()
    return true
  } catch (error) {
    const fallback = editingOnlineTemplateId.value ? '在线文书更新失败' : '在线文书创建失败'
    message.error(getApiErrorMessage(error, fallback))
    return false
  } finally {
    editorSaving.value = false
  }
}

/**
 * @description 从本地已选文件导入文书。
 * @returns 是否成功
 */
async function handleImportFolder() {
  if (importing.value) {
    return false
  }

  if (selectedImportFiles.value.length === 0) {
    message.warning('请先选择要导入的文件或文件夹')
    return false
  }

  importing.value = true
  try {
    const existingSubjectSet = new Set(
      templateList.value
        .map((item) => item.subject.trim())
        .filter((item) => item.length > 0)
    )

    const scannedCount = selectedImportFiles.value.length
    let createdCount = 0
    let duplicateCount = 0
    let failedCount = 0

    for (const entry of selectedImportFiles.value) {
      const subject = normalizeImportSubject(entry.relativePath)
      if (existingSubjectSet.has(subject)) {
        duplicateCount += 1
        continue
      }

      try {
        const payload = await buildLocalImportPayload(entry, subject)
        await templateApi.create(payload)
        existingSubjectSet.add(subject)
        createdCount += 1
      } catch {
        failedCount += 1
      }
    }

    await fetchTemplateList()
    const summaryText = `导入完成：扫描 ${scannedCount}，新增 ${createdCount}，重复 ${duplicateCount}，失败 ${failedCount}`
    if (createdCount > 0 && failedCount === 0) {
      message.success(summaryText)
    } else {
      message.warning(summaryText)
    }

    resetImportSelection()
    return true
  } catch (error) {
    message.error(getApiErrorMessage(error, '导入文书失败'))
    return false
  } finally {
    importing.value = false
  }
}

/**
 * @description 打开文书：链接直接跳转，其他走站内预览。
 * @param item 文书条目
 */
function handleOpenTemplate(item: TemplateItem) {
  const subject = item.subject.trim()
  if (subject && (isHttpUrl(subject) || subject.startsWith('file://'))) {
    window.open(subject, '_blank', 'noopener,noreferrer')
    return
  }

  currentPreviewTemplate.value = item
  showTemplatePreviewModal.value = true
}

/**
 * @description 复制路径到剪贴板。
 * @param subject 路径文本
 */
async function handleCopyPath(subject: string) {
  const value = subject.trim()
  if (!value) {
    message.warning('该条目未填写路径')
    return
  }
  if (!navigator.clipboard) {
    message.error('当前环境不支持剪贴板复制')
    return
  }

  try {
    await navigator.clipboard.writeText(value)
    message.success('路径已复制到剪贴板')
  } catch {
    message.error('复制失败，请检查浏览器剪贴板权限')
  }
}

/**
 * @description 复制摘要到剪贴板。
 * @param content 摘要文本
 */
async function handleCopyContent(content: string) {
  const value = content.trim()
  if (!value) {
    message.warning('该条目暂无内容摘要')
    return
  }

  if (!navigator.clipboard) {
    message.error('当前环境不支持剪贴板复制')
    return
  }

  try {
    await navigator.clipboard.writeText(value)
    message.success('内容摘要已复制到剪贴板')
  } catch {
    message.error('复制失败，请检查浏览器剪贴板权限')
  }
}

/**
 * @description 删除条目并刷新列表。
 * @param id 条目 ID
 */
async function handleDeleteTemplate(id: string) {
  try {
    await templateApi.remove(id)
    message.success('文书资料删除成功')
    await fetchTemplateList()
  } catch (error) {
    message.error(getApiErrorMessage(error, '删除文书资料失败，请稍后重试'))
  }
}

onBeforeUnmount(() => {
  stopAutoSaveLoop()
})

onMounted(() => {
  void fetchTemplateList()
})
</script>

<style scoped>
.template-page {
  gap: 14px;
}

.template-filter-wrap {
  margin-top: -4px;
}

.template-page-footer {
  margin-top: 6px;
  padding-top: 12px;
  border-top: 1px dashed rgba(148, 163, 184, 0.25);
  text-align: center;
  font-size: 12px;
  color: var(--n-text-color-3);
  display: flex;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
}

.template-content-wrap {
  min-height: 220px;
}

.template-preview-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--n-text-color-2);
}

.template-preview-content {
  margin: 0;
  max-height: min(68vh, 720px);
  overflow: auto;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  background: rgba(248, 250, 252, 0.92);
  font-size: 13px;
  line-height: 1.7;
  color: #334155;
  white-space: pre-wrap;
  word-break: break-word;
}

.import-selection-summary {
  font-size: 13px;
  color: var(--n-text-color-2);
}

.import-file-list {
  max-height: 280px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 10px;
  padding: 10px 12px;
  background: rgba(248, 250, 252, 0.7);
  overflow: auto;
}

.import-file-ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.import-file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.import-file-name {
  min-width: 0;
  flex: 1;
  font-size: 12px;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.import-file-more {
  margin-top: 8px;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.hidden-native-input {
  display: none;
}

.template-item-card {
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.template-item-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.template-path-line {
  margin-top: 10px;
  font-size: 12px;
  color: var(--n-text-color-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.template-content-text {
  margin-top: 10px;
  font-size: 13px;
  color: var(--n-text-color-2);
  word-break: break-word;
}

.template-item-actions {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.editor-split-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  width: 100%;
}

.editor-preview-pane {
  min-height: 520px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 10px;
  padding: 10px 12px;
  background: rgba(248, 250, 252, 0.9);
  overflow: auto;
}

.editor-preview-title {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.editor-preview-content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.6;
  color: #334155;
}

.editor-footer-wrap {
  width: 100%;
  gap: 12px;
}

.editor-toolbar-left {
  flex: 1;
  min-width: 0;
}

.editor-status-text {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.editor-version-select {
  width: min(420px, 72vw);
  max-width: 100%;
}

.version-diff-content {
  margin: 0;
  max-height: min(70vh, 760px);
  overflow: auto;
  padding: 10px 12px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.92);
  font-size: 12px;
  line-height: 1.6;
  color: #334155;
  white-space: pre-wrap;
  word-break: break-word;
}

.version-diff-toolbar {
  width: 100%;
}

.version-diff-actions {
  justify-content: flex-end;
}

.line-clamp-4 {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}

@media (max-width: 960px) {
  .editor-split-wrap {
    grid-template-columns: 1fr;
  }

  .editor-preview-pane {
    min-height: 240px;
  }

  .editor-version-select {
    width: 100%;
  }
}
</style>
