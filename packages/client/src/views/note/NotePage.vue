<template>
  <div class="app-page note-page">
    <div class="app-page-header">
      <n-page-header title="笔记管理" subtitle="沉淀导师沟通重点与复盘结论" />
      <n-space>
        <n-button secondary @click="handleRefresh">刷新列表</n-button>
        <n-button type="primary" @click="handleOpenCreatePage">新建笔记</n-button>
      </n-space>
    </div>

    <n-card class="app-card">
      <n-spin :show="loading">
        <div class="note-table-wrap">
          <n-empty
            v-if="!loading && noteList.length === 0"
            description="暂无笔记，点击“新建笔记”开始写作"
            class="app-empty"
          />

          <n-data-table
            v-else
            :columns="columns"
            :data="noteList"
            :row-key="(row: NoteItem) => row.id"
          />
        </div>
      </n-spin>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { h, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NPopconfirm,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { noteApi } from '@/api'

/**
 * @description 导师信息结构。
 */
interface NoteProfessor {
  id: string
  name: string
  university: string
}

/**
 * @description 笔记数据结构。
 */
interface NoteItem {
  id: string
  title: string
  content: string
  professorId: string | null
  professor: NoteProfessor | null
  createdAt: string
  updatedAt: string
}

const router = useRouter()
const message = useMessage()
const loading = ref(false)
const noteList = ref<NoteItem[]>([])

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
 * @description 格式化更新时间。
 * @param value 时间文本
 * @returns 格式化后的日期
 */
function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleDateString('zh-CN')
}

/**
 * @description 生成摘要预览文本。
 * @param content 笔记正文
 * @returns 摘要文本
 */
function getContentPreview(content: string): string {
  const text = content.trim().replace(/\s+/g, ' ')
  if (!text) {
    return '-'
  }
  if (text.length <= 80) {
    return text
  }
  return `${text.slice(0, 80)}...`
}

/**
 * @description 生成关联导师显示文本。
 * @param note 笔记条目
 * @returns 导师名称文本
 */
function getProfessorText(note: NoteItem): string {
  if (!note.professor) {
    return '-'
  }
  return `${note.professor.name}（${note.professor.university}）`
}

/**
 * @description 拉取笔记列表。
 */
async function fetchNoteList() {
  loading.value = true
  try {
    const response = await noteApi.list()
    noteList.value = Array.isArray(response.data?.data)
      ? (response.data.data as NoteItem[])
      : []
  } catch (error) {
    message.error(getApiErrorMessage(error, '获取笔记列表失败'))
  } finally {
    loading.value = false
  }
}

/**
 * @description 打开新建笔记页。
 */
function handleOpenCreatePage() {
  void router.push({ name: 'NoteCreate' })
}

/**
 * @description 打开独立编辑页。
 * @param note 笔记条目
 */
function handleOpenEditPage(note: NoteItem) {
  void router.push({ name: 'NoteEdit', params: { id: note.id } })
}

/**
 * @description 刷新列表。
 */
function handleRefresh() {
  void fetchNoteList()
}

/**
 * @description 删除单条笔记。
 * @param note 笔记条目
 */
async function handleDeleteNote(note: NoteItem) {
  try {
    await noteApi.remove(note.id)
    message.success('笔记删除成功')
    await fetchNoteList()
  } catch (error) {
    message.error(getApiErrorMessage(error, '删除笔记失败'))
  }
}

const columns: DataTableColumns<NoteItem> = [
  {
    title: '标题',
    key: 'title',
    minWidth: 220,
    render: (row) => h(
      NButton,
      {
        text: true,
        type: 'primary',
        onClick: () => handleOpenEditPage(row),
      },
      { default: () => row.title }
    ),
  },
  {
    title: '关联导师',
    key: 'professor',
    minWidth: 180,
    render: (row) => getProfessorText(row),
  },
  {
    title: '内容预览',
    key: 'content',
    minWidth: 320,
    render: (row) => getContentPreview(row.content),
  },
  {
    title: '更新时间',
    key: 'updatedAt',
    width: 140,
    render: (row) => formatDate(row.updatedAt),
  },
  {
    title: '操作',
    key: 'actions',
    width: 180,
    render: (row) => h(
      'div',
      { class: 'note-actions' },
      [
        h(
          NButton,
          {
            text: true,
            type: 'primary',
            onClick: () => handleOpenEditPage(row),
          },
          { default: () => '继续写' }
        ),
        h(
          NPopconfirm,
          {
            onPositiveClick: () => {
              void handleDeleteNote(row)
            },
          },
          {
            trigger: () => h(
              NButton,
              {
                text: true,
                type: 'error',
              },
              { default: () => '删除' }
            ),
            default: () => `确认删除「${row.title}」吗？`,
          }
        ),
      ]
    ),
  },
]

onMounted(() => {
  void fetchNoteList()
})
</script>

<style scoped>
.note-page {
  gap: 14px;
}

.note-table-wrap {
  min-height: 240px;
}

.note-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
