<template>
  <div class="app-page note-editor-page">
    <div class="note-editor-topbar">
      <div class="note-editor-topbar__left">
        <n-button quaternary @click="handleBackToList">返回列表</n-button>
        <div class="note-editor-topbar__copy">
          <h3 class="note-editor-topbar__title">{{ pageHeading }}</h3>
          <p class="note-editor-topbar__subtitle">
            像写文章一样沉浸记录，支持 Ctrl + S 快速保存。
          </p>
        </div>
      </div>

      <n-space :size="10" :wrap="true" align="center">
        <n-tag :bordered="false" :type="isDirty ? 'warning' : 'success'">
          {{ isDirty ? '未保存修改' : '内容已同步' }}
        </n-tag>
        <n-tag :bordered="false" type="info">
          字数 {{ wordCount }}
        </n-tag>
        <span class="note-editor-topbar__status">{{ statusText }}</span>
        <n-button @click="handleBackToList">返回列表</n-button>
        <n-button type="primary" :loading="saving" @click="handleSubmitNote">
          {{ saveButtonText }}
        </n-button>
      </n-space>
    </div>

    <n-spin :show="loading">
      <n-form
        ref="noteFormRef"
        :model="noteForm"
        :rules="noteRules"
        label-placement="top"
        require-mark-placement="right-hanging"
      >
        <div class="note-editor-layout">
          <n-card class="app-card note-editor-main" :bordered="false">
            <n-form-item label="标题" path="title">
              <n-input
                v-model:value="noteForm.title"
                size="large"
                maxlength="100"
                clearable
                placeholder="输入一个清晰标题，比如：导师沟通重点与复盘结论"
                class="note-editor-title-input"
              />
            </n-form-item>

            <n-form-item label="正文" path="content">
              <MarkdownWorkspace
                v-model="noteForm.content"
                placeholder="在这里像写文章一样沉浸记录：沟通要点、导师偏好、风险判断、下一步动作……"
                min-height="68vh"
              />
            </n-form-item>
          </n-card>

          <div class="note-editor-side">
            <n-card class="app-card note-editor-side-card" size="small" title="笔记设置">
              <n-form-item label="关联导师">
                <n-select
                  v-model:value="noteForm.professorId"
                  :options="professorOptions"
                  clearable
                  filterable
                  placeholder="可选：搜索并关联导师"
                />
              </n-form-item>

              <div class="note-editor-side__meta">
                <div>当前模式：{{ isEditMode ? '编辑已有笔记' : '新建笔记' }}</div>
                <div>最后保存：{{ lastSavedText }}</div>
                <div>标题长度：{{ noteForm.title.trim().length }}/100</div>
              </div>
            </n-card>

            <n-card class="app-card note-editor-side-card" size="small" title="写作提示">
              <ul class="note-editor-tip-list">
                <li>先写结论，再补充沟通细节与证据。</li>
                <li>可直接插入标题、引用、列表、链接与代码块。</li>
                <li>记录导师关注点、回复风格与潜在机会。</li>
                <li>按下 Ctrl + S 可快速保存当前内容。</li>
              </ul>
            </n-card>
          </div>
        </div>
      </n-form>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from 'vue'
import {
  onBeforeRouteLeave,
  useRoute,
  useRouter,
} from 'vue-router'
import {
  useMessage,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import MarkdownWorkspace from '@/components/MarkdownWorkspace.vue'
import { noteApi, professorApi } from '@/api'

/**
 * @description 导师下拉项结构。
 */
interface ProfessorOptionItem {
  id: string
  name: string
  university: string
}

/**
 * @description 笔记详情结构。
 */
interface NoteDetailItem {
  id: string
  title: string
  content: string
  professorId: string | null
  updatedAt: string
}

/**
 * @description 笔记表单结构。
 */
interface NoteFormModel {
  title: string
  content: string
  professorId: string
}

const route = useRoute()
const router = useRouter()
const message = useMessage()

const loading = ref(false)
const saving = ref(false)
const noteFormRef = ref<FormInst | null>(null)
const professorOptions = ref<Array<{ label: string; value: string }>>([])
const lastSavedAt = ref('')
const initialSnapshot = ref('')

const noteForm = reactive<NoteFormModel>({
  title: '',
  content: '',
  professorId: '',
})

const noteRules: FormRules = {
  title: [{ required: true, message: '请输入标题', trigger: ['blur', 'input'] }],
  content: [{ required: true, message: '请输入正文内容', trigger: ['blur', 'input'] }],
}

const noteId = computed(() => (
  typeof route.params.id === 'string' ? route.params.id.trim() : ''
))

const isEditMode = computed(() => noteId.value.length > 0)
const pageHeading = computed(() => (
  isEditMode.value ? '继续写笔记' : '新建笔记'
))
const saveButtonText = computed(() => (
  isEditMode.value ? '保存修改' : '发布笔记'
))
const wordCount = computed(() => noteForm.content.trim().length)
const isDirty = computed(() => createFormSnapshot() !== initialSnapshot.value)
const lastSavedText = computed(() => (
  lastSavedAt.value ? formatDateTimeLabel(lastSavedAt.value) : '尚未保存'
))
const statusText = computed(() => {
  if (loading.value) {
    return '正在加载内容'
  }
  if (saving.value) {
    return '正在保存…'
  }
  if (lastSavedAt.value) {
    return `上次保存：${formatDateTimeLabel(lastSavedAt.value)}`
  }
  return isEditMode.value ? '尚未保存本次修改' : '新笔记尚未保存'
})

/**
 * @description 获取统一错误信息。
 * @param error 错误对象
 * @param fallback 兜底文案
 * @returns 错误信息
 */
function getApiErrorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback
}

/**
 * @description 格式化时间文本。
 * @param value 时间字符串
 * @returns 格式化后的时间
 */
function formatDateTimeLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleString('zh-CN', { hour12: false })
}

/**
 * @description 重置笔记表单。
 */
function resetNoteForm() {
  noteForm.title = ''
  noteForm.content = ''
  noteForm.professorId = ''
}

/**
 * @description 生成当前表单快照。
 * @returns 快照字符串
 */
function createFormSnapshot(): string {
  return JSON.stringify({
    title: noteForm.title.trim(),
    content: noteForm.content.trim(),
    professorId: noteForm.professorId.trim(),
  })
}

/**
 * @description 同步当前快照为已保存状态。
 */
function syncSavedSnapshot() {
  initialSnapshot.value = createFormSnapshot()
}

/**
 * @description 判断是否允许离开当前页面。
 * @returns 是否允许离开
 */
function confirmLeaveIfDirty(): boolean {
  if (saving.value || !isDirty.value) {
    return true
  }
  return window.confirm('当前笔记还有未保存的修改，确定离开吗？')
}

/**
 * @description 获取导师下拉选项。
 */
async function fetchProfessorOptions() {
  const response = await professorApi.list()
  const professorList = Array.isArray(response.data?.data)
    ? (response.data.data as ProfessorOptionItem[])
    : []

  professorOptions.value = professorList.map((item) => ({
    label: `${item.name}（${item.university}）`,
    value: item.id,
  }))
}

/**
 * @description 获取笔记详情并回填表单。
 */
async function fetchNoteDetail() {
  if (!isEditMode.value) {
    resetNoteForm()
    lastSavedAt.value = ''
    syncSavedSnapshot()
    return
  }

  const response = await noteApi.detail(noteId.value)
  const note = (response.data?.data ?? null) as NoteDetailItem | null
  if (!note) {
    throw new Error('笔记不存在或已被删除')
  }

  noteForm.title = note.title || ''
  noteForm.content = note.content || ''
  noteForm.professorId = note.professorId || ''
  lastSavedAt.value = note.updatedAt || ''
  syncSavedSnapshot()
}

/**
 * @description 拉取编辑页所需数据。
 */
async function fetchPageData() {
  loading.value = true
  try {
    await fetchProfessorOptions()
    await fetchNoteDetail()
  } catch (error) {
    message.error(getApiErrorMessage(error, '获取笔记内容失败'))
    void router.replace({ name: 'Notes' })
  } finally {
    loading.value = false
  }
}

/**
 * @description 保存当前笔记。
 */
async function handleSubmitNote() {
  if (saving.value) {
    return
  }

  try {
    await noteFormRef.value?.validate()
  } catch {
    return
  }

  const payload = {
    title: noteForm.title.trim(),
    content: noteForm.content.trim(),
    professorId: noteForm.professorId.trim() || null,
  }

  if (!payload.title || !payload.content) {
    message.warning('标题和正文不能为空')
    return
  }

  saving.value = true
  try {
    if (isEditMode.value) {
      const response = await noteApi.update(noteId.value, payload)
      const updatedNote = (response.data?.data ?? null) as NoteDetailItem | null
      lastSavedAt.value = updatedNote?.updatedAt || new Date().toISOString()
      syncSavedSnapshot()
      message.success('笔记保存成功')
      return
    }

    const response = await noteApi.create(payload)
    const createdNote = (response.data?.data ?? null) as NoteDetailItem | null
    lastSavedAt.value = createdNote?.updatedAt || new Date().toISOString()
    syncSavedSnapshot()
    message.success('笔记创建成功')

    if (createdNote?.id) {
      await router.replace({ name: 'NoteEdit', params: { id: createdNote.id } })
    }
  } catch (error) {
    const fallback = isEditMode.value ? '保存笔记失败' : '创建笔记失败'
    message.error(getApiErrorMessage(error, fallback))
  } finally {
    saving.value = false
  }
}

/**
 * @description 返回笔记列表。
 */
function handleBackToList() {
  if (!confirmLeaveIfDirty()) {
    return
  }
  void router.push({ name: 'Notes' })
}

/**
 * @description 处理快捷键保存。
 * @param event 键盘事件
 */
function handleWindowKeydown(event: KeyboardEvent) {
  const keyText = event.key.toLowerCase()
  if (!(event.ctrlKey || event.metaKey) || keyText !== 's') {
    return
  }

  event.preventDefault()
  void handleSubmitNote()
}

onBeforeRouteLeave(() => confirmLeaveIfDirty())

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)
  void fetchPageData()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
})
</script>

<style scoped>
.note-editor-page {
  gap: 16px;
}

.note-editor-topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.note-editor-topbar__left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.note-editor-topbar__copy {
  min-width: 0;
}

.note-editor-topbar__title {
  margin: 0;
  font-size: 26px;
  line-height: 1.2;
  color: #0f172a;
}

.note-editor-topbar__subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: #64748b;
}

.note-editor-topbar__status {
  font-size: 12px;
  color: #64748b;
}

.note-editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: start;
}

.note-editor-main :deep(.n-card__content) {
  padding: 22px;
}

.note-editor-title-input :deep(input) {
  font-size: 26px;
  font-weight: 700;
}

.note-editor-side {
  position: sticky;
  top: 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.note-editor-side__meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: #64748b;
}

.note-editor-tip-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: #475569;
  line-height: 1.7;
}

@media (max-width: 1100px) {
  .note-editor-layout {
    grid-template-columns: 1fr;
  }

  .note-editor-side {
    position: static;
  }
}
</style>
