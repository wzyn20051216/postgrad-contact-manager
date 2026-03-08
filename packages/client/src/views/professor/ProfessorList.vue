<template>
  <div class="app-page professor-page">
    <div class="app-page-header">
      <n-page-header title="导师管理" subtitle="管理你的导师信息" />
      <n-button type="primary" @click="goToCreate">新建导师</n-button>
    </div>

    <n-card class="app-card">
      <div class="app-toolbar professor-toolbar">
        <div class="app-toolbar__left">
          <n-input
            v-model:value="searchKeyword"
            placeholder="输入姓名/学校/研究方向"
            clearable
            style="width: 280px"
            @keyup.enter="handleSearch"
          />
          <n-select
            v-model:value="statusFilter"
            :options="statusOptions"
            placeholder="筛选联系状态"
            clearable
            style="width: 220px"
            @update:value="handleSearch"
          />
          <n-button @click="handleSearch">搜索</n-button>
        </div>
        <div class="app-toolbar__right">
          <span class="app-chip">总数 {{ total }}</span>
        </div>
      </div>

      <n-data-table
        v-if="professors.length > 0 || loading"
        :columns="columns"
        :data="professors"
        :loading="loading"
        :row-key="(row: ProfessorItem) => row.id"
      />
      <n-empty
        v-if="!loading && professors.length === 0 && !searchKeyword && !statusFilter"
        description="还没有导师信息"
        class="professor-empty"
      >
        <template #extra>
          <n-space justify="center">
            <n-button type="primary" @click="goToCreate">添加第一位导师</n-button>
            <n-button @click="router.push({ name: 'Kanban' })">查看看板</n-button>
          </n-space>
        </template>
      </n-empty>

      <div class="professor-pagination">
        <n-pagination
          :page="page"
          :page-size="pageSize"
          :item-count="total"
          @update:page="handlePageChange"
        />
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { h, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NSpace,
  NTag,
  useDialog,
  useMessage,
  type DataTableColumns,
  type TagProps,
} from 'naive-ui'
import { professorApi } from '@/api'

type ContactStatus =
  | 'NOT_CONTACTED'
  | 'EMAIL_SENT'
  | 'REPLIED'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEWED'
  | 'ACCEPTED'
  | 'REJECTED'

interface ProfessorItem {
  id: string
  name: string
  university: string
  college: string
  title: string
  researchArea: string
  schoolRating: string
  contactStatus: ContactStatus | string
}

interface ProfessorListResponse {
  data?: {
    list?: ProfessorItem[]
    total?: number
  }
}

const router = useRouter()
const dialog = useDialog()
const message = useMessage()

const loading = ref(false)
const professors = ref<ProfessorItem[]>([])
const page = ref(1)
const total = ref(0)
const pageSize = 20
const searchKeyword = ref('')
const statusFilter = ref<string | null>(null)

const statusLabelMap: Record<ContactStatus, string> = {
  NOT_CONTACTED: '未联系',
  EMAIL_SENT: '已发邮件',
  REPLIED: '已回复',
  INTERVIEW_SCHEDULED: '已约面试',
  INTERVIEWED: '已面试',
  ACCEPTED: '已录取',
  REJECTED: '已拒绝',
}

const statusTypeMap: Record<ContactStatus, TagProps['type']> = {
  NOT_CONTACTED: 'default',
  EMAIL_SENT: 'info',
  REPLIED: 'warning',
  INTERVIEW_SCHEDULED: 'primary',
  INTERVIEWED: 'success',
  ACCEPTED: 'success',
  REJECTED: 'error',
}

const statusOptions = [
  { label: '未联系', value: 'NOT_CONTACTED' },
  { label: '已发邮件', value: 'EMAIL_SENT' },
  { label: '已回复', value: 'REPLIED' },
  { label: '已约面试', value: 'INTERVIEW_SCHEDULED' },
  { label: '已面试', value: 'INTERVIEWED' },
  { label: '已录取', value: 'ACCEPTED' },
  { label: '已拒绝', value: 'REJECTED' },
]

function getStatusLabel(status: string) {
  return statusLabelMap[status as ContactStatus] ?? status
}

function getStatusType(status: string): TagProps['type'] {
  return statusTypeMap[status as ContactStatus] ?? 'default'
}

async function fetchProfessors() {
  loading.value = true
  try {
    const response = await professorApi.list({
      page: page.value,
      pageSize,
      search: searchKeyword.value.trim() || undefined,
      status: statusFilter.value || undefined,
    })

    const payload = response.data as ProfessorListResponse | undefined
    const list = Array.isArray(payload?.data?.list) ? payload.data.list : []
    const totalCount = typeof payload?.data?.total === 'number' ? payload.data.total : 0

    professors.value = list
    total.value = totalCount

    if (page.value > 1 && professors.value.length === 0 && total.value > 0) {
      page.value -= 1
      await fetchProfessors()
    }
  } catch (error) {
    message.error('获取导师列表失败')
  } finally {
    loading.value = false
  }
}

function goToCreate() {
  router.push('/professors/new')
}

function goToDetail(id: string) {
  router.push(`/professors/${id}`)
}

function goToEdit(id: string) {
  router.push(`/professors/${id}/edit`)
}

function handleSearch() {
  page.value = 1
  void fetchProfessors()
}

function handlePageChange(nextPage: number) {
  page.value = nextPage
  void fetchProfessors()
}

function handleDelete(row: ProfessorItem) {
  dialog.warning({
    title: '确认删除',
    content: `确定删除导师「${row.name}」吗？删除后不可恢复。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await professorApi.remove(row.id)
        message.success('删除成功')
        await fetchProfessors()
      } catch (error) {
        message.error('删除失败，请稍后重试')
      }
    },
  })
}

const columns: DataTableColumns<ProfessorItem> = [
  { title: '姓名', key: 'name' },
  { title: '学校', key: 'university' },
  { title: '学院', key: 'college' },
  { title: '职称', key: 'title' },
  { title: '研究方向', key: 'researchArea' },
  { title: '院校评级', key: 'schoolRating' },
  {
    title: '联系状态',
    key: 'contactStatus',
    width: 120,
    render: (row) =>
      h(
        NTag,
        {
          type: getStatusType(row.contactStatus),
          bordered: false,
        },
        { default: () => getStatusLabel(row.contactStatus) }
      ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 180,
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
                onClick: () => goToDetail(row.id),
              },
              { default: () => '详情' }
            ),
            h(
              NButton,
              {
                text: true,
                onClick: () => goToEdit(row.id),
              },
              { default: () => '编辑' }
            ),
            h(
              NButton,
              {
                text: true,
                type: 'error',
                onClick: () => handleDelete(row),
              },
              { default: () => '删除' }
            ),
          ],
        }
      ),
  },
]

onMounted(() => {
  void fetchProfessors()
})
</script>

<style scoped>
.professor-page {
  gap: 14px;
}

.professor-toolbar {
  margin-bottom: 14px;
}

.professor-pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.professor-empty {
  padding: 60px 0;
  text-align: center;
}
</style>
