<template>
  <div class="app-page tag-page">
    <div class="app-page-header">
      <n-page-header title="标签管理" subtitle="管理导师标签分类" />
      <n-button type="primary" @click="handleOpenCreateModal">新建标签</n-button>
    </div>

    <n-card class="app-card">
      <n-spin :show="loading">
        <div class="tag-content-wrap">
          <n-empty
            v-if="!loading && tagList.length === 0"
            description="暂无标签，点击“新建标签”开始创建"
            class="app-empty"
          />

          <n-grid
            v-else
            cols="1 s:2 m:3 l:4"
            responsive="screen"
            :x-gap="16"
            :y-gap="16"
          >
            <n-gi v-for="tag in tagList" :key="tag.id">
              <n-card size="small" hoverable class="tag-item-card">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex items-center gap-2">
                    <span
                      class="h-3 w-3 flex-shrink-0 rounded-full border border-[#d9d9d9]"
                      :style="{ backgroundColor: getTagColor(tag) }"
                    />
                    <span class="truncate text-base font-medium">
                      {{ tag.name }}
                    </span>
                  </div>
                </div>

                <div class="mt-3 text-sm text-[var(--n-text-color-3)]">
                  使用导师数量：{{ getProfessorCount(tag) }}
                </div>

                <div class="mt-4 flex justify-end gap-2">
                  <n-button size="small" @click="handleOpenEditModal(tag)">编辑</n-button>
                  <n-button
                    size="small"
                    type="error"
                    secondary
                    @click="handleDeleteTag(tag)"
                  >
                    删除
                  </n-button>
                </div>
              </n-card>
            </n-gi>
          </n-grid>
        </div>
      </n-spin>
    </n-card>

    <n-modal
      v-model:show="showTagModal"
      preset="card"
      :title="tagModalTitle"
      style="width: 520px"
      :mask-closable="false"
      @after-leave="resetTagModalState"
    >
      <n-form
        ref="tagFormRef"
        :model="tagForm"
        :rules="tagRules"
        label-placement="top"
        require-mark-placement="right-hanging"
      >
        <n-form-item label="标签名称" path="name">
          <n-input
            v-model:value="tagForm.name"
            placeholder="请输入标签名称"
            maxlength="30"
            clearable
          />
        </n-form-item>

        <n-form-item label="标签颜色" path="color">
          <n-space vertical :size="10">
            <n-color-picker
              v-model:value="tagForm.color"
              :modes="['hex']"
              :show-alpha="false"
            />
            <n-input
              v-model:value="tagForm.color"
              placeholder="请输入 16 进制颜色值，例如 #4F8EF7"
              clearable
            />
          </n-space>
        </n-form-item>
      </n-form>

      <template #footer>
        <div class="flex justify-end gap-3">
          <n-button @click="showTagModal = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="handleSubmitTag">
            保存
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useDialog, useMessage, type FormInst, type FormRules } from 'naive-ui'
import { tagApi } from '@/api'

/**
 * @description 单个标签数据结构。
 */
interface TagItem {
  id: string
  name: string
  color: string | null
  _count?: {
    professors?: number
  }
}

/**
 * @description 标签表单数据模型。
 */
interface TagFormModel {
  name: string
  color: string
}

const DEFAULT_TAG_COLOR = '#4F8EF7'
const HEX_COLOR_PATTERN = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/

const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const saving = ref(false)
const showTagModal = ref(false)
const editingTagId = ref<string | null>(null)
const tagList = ref<TagItem[]>([])
const tagFormRef = ref<FormInst | null>(null)

const tagForm = reactive<TagFormModel>({
  name: '',
  color: DEFAULT_TAG_COLOR,
})

const tagRules: FormRules = {
  name: [{ required: true, message: '请输入标签名称', trigger: ['blur', 'input'] }],
  color: [
    { required: true, message: '请输入标签颜色', trigger: ['blur', 'input'] },
    {
      validator: (_rule, value: string) => isHexColor(value),
      message: '颜色格式需为 #RGB 或 #RRGGBB',
      trigger: ['blur', 'input'],
    },
  ],
}

const tagModalTitle = computed(() => (editingTagId.value ? '编辑标签' : '新建标签'))

/**
 * @description 统一提取后端错误消息。
 */
function getApiErrorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback
}

/**
 * @description 判断颜色值是否为合法 16 进制颜色。
 */
function isHexColor(value: string | null | undefined): boolean {
  if (!value) {
    return false
  }
  return HEX_COLOR_PATTERN.test(value.trim())
}

/**
 * @description 规范化颜色值，非法时返回默认颜色。
 */
function normalizeColor(value: string | null | undefined): string {
  const color = value?.trim() ?? ''
  return isHexColor(color) ? color : DEFAULT_TAG_COLOR
}

/**
 * @description 解析标签列表，兼容数组和 { data: [] } 结构。
 */
function extractTagList(payload: unknown): TagItem[] {
  if (Array.isArray(payload)) {
    return payload as TagItem[]
  }
  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: TagItem[] }).data
  }
  return []
}

/**
 * @description 获取标签颜色展示值。
 */
function getTagColor(tag: TagItem): string {
  return normalizeColor(tag.color)
}

/**
 * @description 获取标签关联导师数量。
 */
function getProfessorCount(tag: TagItem): number {
  return typeof tag._count?.professors === 'number' ? tag._count.professors : 0
}

/**
 * @description 重置标签表单到初始状态。
 */
function resetTagForm() {
  tagForm.name = ''
  tagForm.color = DEFAULT_TAG_COLOR
}

/**
 * @description 弹窗关闭后重置状态与校验信息。
 */
function resetTagModalState() {
  editingTagId.value = null
  tagFormRef.value?.restoreValidation()
  resetTagForm()
}

/**
 * @description 获取标签列表数据。
 */
async function fetchTagList() {
  loading.value = true
  try {
    const response = await tagApi.list()
    tagList.value = extractTagList(response.data)
  } catch (error) {
    message.error(getApiErrorMessage(error, '获取标签列表失败'))
  } finally {
    loading.value = false
  }
}

/**
 * @description 打开新建标签弹窗。
 */
function handleOpenCreateModal() {
  editingTagId.value = null
  resetTagForm()
  tagFormRef.value?.restoreValidation()
  showTagModal.value = true
}

/**
 * @description 打开编辑标签弹窗并回填数据。
 */
function handleOpenEditModal(tag: TagItem) {
  editingTagId.value = tag.id
  tagForm.name = tag.name
  tagForm.color = normalizeColor(tag.color)
  tagFormRef.value?.restoreValidation()
  showTagModal.value = true
}

/**
 * @description 提交标签创建或更新请求。
 */
async function handleSubmitTag() {
  if (saving.value) {
    return
  }

  try {
    await tagFormRef.value?.validate()
  } catch {
    return
  }

  saving.value = true
  const payload = {
    name: tagForm.name.trim(),
    color: normalizeColor(tagForm.color),
  }

  try {
    if (editingTagId.value) {
      await tagApi.update(editingTagId.value, payload)
      message.success('标签更新成功')
    } else {
      await tagApi.create(payload)
      message.success('标签创建成功')
    }

    showTagModal.value = false
    await fetchTagList()
  } catch (error) {
    const fallback = editingTagId.value ? '更新标签失败' : '创建标签失败'
    message.error(getApiErrorMessage(error, fallback))
  } finally {
    saving.value = false
  }
}

/**
 * @description 删除标签前进行二次确认。
 */
function handleDeleteTag(tag: TagItem) {
  dialog.warning({
    title: '确认删除',
    content: `确定删除标签「${tag.name}」吗？删除后不可恢复。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await tagApi.remove(tag.id)
        message.success('标签删除成功')
        await fetchTagList()
      } catch (error) {
        message.error(getApiErrorMessage(error, '删除标签失败，请稍后重试'))
      }
    },
  })
}

onMounted(() => {
  void fetchTagList()
})
</script>

<style scoped>
.tag-page {
  gap: 14px;
}

.tag-content-wrap {
  min-height: 180px;
}

.tag-item-card {
  border: 1px solid rgba(148, 163, 184, 0.2);
}
</style>
