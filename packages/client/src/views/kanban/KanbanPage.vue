<template>
  <div class="app-page kanban-page">
    <div class="kanban-toolbar">
      <div>
        <h2 class="kanban-title">导师联系看板</h2>
        <p class="kanban-subtitle">拖拽卡片可快速更新联系状态</p>
      </div>
      <div class="app-toolbar__right">
        <span class="app-chip">导师总量 {{ totalProfessorCount }}</span>
        <n-button :loading="loading" @click="fetchProfessors">
          刷新数据
        </n-button>
      </div>
    </div>

    <n-spin :show="loading">
      <div class="kanban-scroll">
        <div class="kanban-board">
          <n-card
            v-for="column in kanbanColumns"
            :key="column.status"
            size="small"
            class="app-card kanban-column"
          >
            <template #header>
              <div class="kanban-column-header">
                <div class="kanban-column-title" @click="toggleColumn(column.status)">
                  <n-tag :type="getStatusType(column.status)" :bordered="false" size="small">
                    {{ ContactStatusLabel[column.status] }}
                  </n-tag>
                  <n-badge :value="column.items.length" :show-zero="true" />
                </div>
                <n-button text size="tiny" @click.stop="toggleColumn(column.status)">
                  {{ collapsedMap[column.status] ? '展开' : '折叠' }}
                </n-button>
              </div>
            </template>

            <n-empty
              v-if="collapsedMap[column.status]"
              description="该列已折叠"
              size="small"
              class="kanban-empty"
            />

            <VueDraggable
              v-else
              v-model="boardMap[column.status]"
              item-key="id"
              :group="{ name: 'professor-kanban' }"
              :animation="180"
              ghost-class="kanban-ghost"
              chosen-class="kanban-chosen"
              drag-class="kanban-drag"
              :data-status="column.status"
              class="kanban-list"
              @add="(event) => void handleCardAdd(event, column.status)"
            >
              <n-card
                v-for="professor in boardMap[column.status]"
                :key="professor.id"
                size="small"
                class="app-card kanban-item"
                :class="{ 'kanban-item--pending': updatingIds.has(professor.id) }"
              >
                <div class="kanban-item-name">
                  {{ professor.name || '未命名导师' }}
                </div>
                <div class="kanban-item-meta">{{ professor.university || '未知学校' }}</div>
                <div class="kanban-item-meta">{{ professor.college || '未知学院' }}</div>
                <n-tag size="small" :bordered="false">
                  {{
                    professor.schoolRating
                      ? `院校评级 ${professor.schoolRating}`
                      : '院校评级 未设置'
                  }}
                </n-tag>
              </n-card>

              <n-empty
                v-if="boardMap[column.status].length === 0"
                description="暂无导师"
                size="small"
                class="kanban-empty"
              />
            </VueDraggable>
          </n-card>
        </div>
      </div>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMessage, type TagProps } from 'naive-ui'
import { VueDraggable } from 'vue-draggable-plus'
import { professorApi } from '@/api'

const ContactStatus = {
  NOT_CONTACTED: 'NOT_CONTACTED',
  EMAIL_SENT: 'EMAIL_SENT',
  REPLIED: 'REPLIED',
  INTERVIEW_SCHEDULED: 'INTERVIEW_SCHEDULED',
  INTERVIEWED: 'INTERVIEWED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  PENDING: 'PENDING',
} as const

type ContactStatusType = typeof ContactStatus[keyof typeof ContactStatus]

const ContactStatusLabel: Record<ContactStatusType, string> = {
  NOT_CONTACTED: '未联系',
  EMAIL_SENT: '已发邮件',
  REPLIED: '已回复',
  INTERVIEW_SCHEDULED: '面试已安排',
  INTERVIEWED: '已面试',
  ACCEPTED: '已接受',
  REJECTED: '已拒绝',
  PENDING: '待定',
}

interface ProfessorItem {
  id: string
  name: string
  university?: string | null
  college?: string | null
  schoolRating?: string | null
  contactStatus: ContactStatusType | string
}

interface ProfessorListResponse {
  data?: {
    list?: ProfessorItem[]
  }
}

interface DragAddEvent {
  from?: HTMLElement | null
  newIndex?: number | null
}

type KanbanBoardMap = Record<ContactStatusType, ProfessorItem[]>
type KanbanCollapsedMap = Record<ContactStatusType, boolean>

const message = useMessage()
const loading = ref(false)
const updatingIds = ref<Set<string>>(new Set())

const statusOrder: ContactStatusType[] = [
  ContactStatus.NOT_CONTACTED,
  ContactStatus.EMAIL_SENT,
  ContactStatus.REPLIED,
  ContactStatus.INTERVIEW_SCHEDULED,
  ContactStatus.INTERVIEWED,
  ContactStatus.ACCEPTED,
  ContactStatus.REJECTED,
  ContactStatus.PENDING,
]

const statusTypeMap: Record<ContactStatusType, TagProps['type']> = {
  NOT_CONTACTED: 'default',
  EMAIL_SENT: 'info',
  REPLIED: 'warning',
  INTERVIEW_SCHEDULED: 'primary',
  INTERVIEWED: 'success',
  ACCEPTED: 'success',
  REJECTED: 'error',
  PENDING: 'default',
}

const createEmptyBoard = (): KanbanBoardMap => {
  const board = {} as KanbanBoardMap
  statusOrder.forEach((status) => {
    board[status] = []
  })
  return board
}

const createCollapsedState = (): KanbanCollapsedMap => {
  const collapsed = {} as KanbanCollapsedMap
  statusOrder.forEach((status) => {
    collapsed[status] = false
  })
  return collapsed
}

const boardMap = ref<KanbanBoardMap>(createEmptyBoard())
const collapsedMap = ref<KanbanCollapsedMap>(createCollapsedState())

const kanbanColumns = computed(() =>
  statusOrder.map((status) => ({
    status,
    items: boardMap.value[status],
  }))
)

const totalProfessorCount = computed(() => (
  statusOrder.reduce((count, status) => count + boardMap.value[status].length, 0)
))

const isValidStatus = (status: string): status is ContactStatusType =>
  statusOrder.includes(status as ContactStatusType)

const normalizeStatus = (status: string | undefined | null): ContactStatusType => {
  if (status && isValidStatus(status)) {
    return status
  }
  return ContactStatus.PENDING
}

const getStatusType = (status: ContactStatusType): TagProps['type'] =>
  statusTypeMap[status] ?? 'default'

const setUpdatingState = (id: string, updating: boolean) => {
  const nextSet = new Set(updatingIds.value)
  if (updating) {
    nextSet.add(id)
  } else {
    nextSet.delete(id)
  }
  updatingIds.value = nextSet
}

const toggleColumn = (status: ContactStatusType) => {
  collapsedMap.value = {
    ...collapsedMap.value,
    [status]: !collapsedMap.value[status],
  }
}

const fetchProfessors = async () => {
  loading.value = true
  try {
    const response = await professorApi.list({
      page: 1,
      pageSize: 1000,
    })

    const payload = response.data as ProfessorListResponse | undefined
    const list = Array.isArray(payload?.data?.list) ? payload.data.list : []
    const nextBoard = createEmptyBoard()

    list.forEach((professor) => {
      const status = normalizeStatus(professor.contactStatus)
      nextBoard[status].push({
        ...professor,
        contactStatus: status,
      })
    })

    boardMap.value = nextBoard
  } catch (error) {
    message.error('加载导师数据失败')
  } finally {
    loading.value = false
  }
}

const handleCardAdd = async (event: DragAddEvent, targetStatus: ContactStatusType) => {
  const fromStatusRaw = event.from?.dataset.status
  const sourceStatus =
    fromStatusRaw && isValidStatus(fromStatusRaw) ? fromStatusRaw : undefined

  if (!sourceStatus || sourceStatus === targetStatus) {
    return
  }

  const targetList = boardMap.value[targetStatus]
  const newIndex = typeof event.newIndex === 'number' ? event.newIndex : -1
  const movedProfessor = newIndex >= 0 ? targetList[newIndex] : undefined

  if (!movedProfessor) {
    return
  }

  setUpdatingState(movedProfessor.id, true)

  try {
    await professorApi.updateStatus(movedProfessor.id, targetStatus)
    movedProfessor.contactStatus = targetStatus
    message.success(`已更新为${ContactStatusLabel[targetStatus]}`)
  } catch (error) {
    message.error('状态更新失败，正在恢复列表')
    await fetchProfessors()
  } finally {
    setUpdatingState(movedProfessor.id, false)
  }
}

onMounted(() => {
  void fetchProfessors()
})
</script>

<style scoped>
.kanban-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.kanban-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.kanban-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.kanban-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--n-text-color-3);
}

.kanban-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 2px;
}

.kanban-board {
  display: grid;
  grid-template-columns: repeat(8, minmax(260px, 1fr));
  gap: 12px;
  min-width: 2160px;
  align-items: start;
}

.kanban-column {
  min-width: 240px;
  height: fit-content;
}

.kanban-column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.kanban-column-title {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.kanban-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 110px;
}

.kanban-item {
  cursor: grab;
}

.kanban-item--pending {
  opacity: 0.6;
}

.kanban-item-name {
  margin-bottom: 8px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
}

.kanban-item-meta {
  margin-bottom: 4px;
  font-size: 13px;
  color: var(--n-text-color-3);
}

.kanban-empty {
  margin: 0;
  padding: 16px 0;
}

.kanban-ghost {
  opacity: 0.35;
}

.kanban-chosen {
  box-shadow: 0 0 0 1px var(--n-primary-color);
}

.kanban-drag {
  cursor: grabbing;
}

@media (max-width: 768px) {
  .kanban-board {
    gap: 12px;
  }

  .kanban-column {
    min-width: 200px;
  }

  .kanban-title {
    font-size: 18px;
  }

  .kanban-toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .app-toolbar__right {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
