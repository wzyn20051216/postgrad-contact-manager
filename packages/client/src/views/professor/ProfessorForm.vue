<template>
  <div class="app-page professor-form-page">
    <n-page-header
      :title="isEdit ? '编辑导师' : '新建导师'"
      subtitle="填写导师基础信息"
      @back="handleCancel"
    />
    <n-card class="app-card">
      <n-spin :show="loadingDetail">
        <n-form
          ref="formRef"
          :model="formData"
          :rules="rules"
          label-placement="top"
          require-mark-placement="right-hanging"
        >
          <n-collapse :default-expanded-names="['basic', 'contact', 'evaluation']" arrow-placement="right">
            <n-collapse-item title="基础信息" name="basic">
              <n-grid :cols="24" :x-gap="16">
                <n-form-item-gi :span="12" label="姓名" path="name">
                  <n-input v-model:value="formData.name" placeholder="请输入姓名" />
                </n-form-item-gi>

                <n-form-item-gi :span="12" label="学校" path="university">
                  <n-input v-model:value="formData.university" placeholder="请输入学校" />
                </n-form-item-gi>

                <n-form-item-gi :span="12" label="学院" path="college">
                  <n-input v-model:value="formData.college" placeholder="请输入学院" />
                </n-form-item-gi>

                <n-form-item-gi :span="12" label="职称" path="title">
                  <n-select
                    v-model:value="formData.title"
                    :options="titleOptions"
                    placeholder="请选择职称"
                  />
                </n-form-item-gi>

                <n-form-item-gi :span="12" label="研究方向" path="researchArea">
                  <n-input v-model:value="formData.researchArea" placeholder="请输入研究方向" />
                </n-form-item-gi>
              </n-grid>
            </n-collapse-item>

            <n-collapse-item title="联系方式" name="contact">
              <n-grid :cols="24" :x-gap="16">
                <n-form-item-gi :span="12" label="邮箱" path="email">
                  <n-input v-model:value="formData.email" placeholder="请输入邮箱" />
                </n-form-item-gi>

                <n-form-item-gi :span="12" label="电话" path="phone">
                  <n-input v-model:value="formData.phone" placeholder="请输入电话" />
                </n-form-item-gi>

                <n-form-item-gi :span="12" label="个人主页" path="homepage">
                  <n-input v-model:value="formData.homepage" placeholder="请输入个人主页链接" />
                </n-form-item-gi>

                <n-form-item-gi :span="12" label="微信号" path="wechat">
                  <n-input v-model:value="formData.wechat" placeholder="请输入微信号" />
                </n-form-item-gi>
              </n-grid>
            </n-collapse-item>

            <n-collapse-item title="评价与其他" name="evaluation">
              <n-grid :cols="24" :x-gap="16">
                <n-form-item-gi :span="12" label="院校评级" path="schoolRating">
                  <n-select
                    v-model:value="formData.schoolRating"
                    :options="schoolRatingOptions"
                    placeholder="请选择院校评级"
                  />
                </n-form-item-gi>

                <n-form-item-gi :span="12" label="是否招生" path="acceptingStudents">
                  <n-switch v-model:value="formData.acceptingStudents" />
                </n-form-item-gi>

                <n-form-item-gi :span="12" label="招生名额" path="enrollmentQuota">
                  <n-input-number
                    v-model:value="formData.enrollmentQuota"
                    :min="0"
                    :precision="0"
                    :disabled="!formData.acceptingStudents"
                    style="width: 100%"
                    placeholder="请输入招生名额"
                  />
                </n-form-item-gi>

                <n-form-item-gi :span="12" label="信息来源" path="source">
                  <n-input v-model:value="formData.source" placeholder="请输入信息来源" />
                </n-form-item-gi>

                <n-form-item-gi :span="12" label="导师风评分" path="reputationScore">
                  <n-rate v-model:value="formData.reputationScore" :count="5" clearable />
                </n-form-item-gi>

                <n-form-item-gi :span="12" label="风评备注" path="reputationComment">
                  <n-input v-model:value="formData.reputationComment" placeholder="请输入风评备注" />
                </n-form-item-gi>

                <n-form-item-gi :span="24" label="备注" path="notes">
                  <n-input
                    v-model:value="formData.notes"
                    type="textarea"
                    :rows="4"
                    placeholder="请输入备注"
                  />
                </n-form-item-gi>
              </n-grid>
            </n-collapse-item>
          </n-collapse>

          <div class="form-actions">
            <n-button @click="handleCancel">取消</n-button>
            <n-button type="primary" :loading="saving" @click="handleSubmit">保存</n-button>
          </div>
        </n-form>
      </n-spin>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage, type FormInst, type FormRules } from 'naive-ui'
import { professorApi, type ApiResponse } from '@/api'

/**
 * @description 导师详情数据结构。
 */
interface ProfessorDetail {
  name: string
  university: string
  college: string
  title: string
  researchArea: string
  email: string | null
  phone: string | null
  homepage: string | null
  wechat: string | null
  schoolRating: string | null
  reputationScore: number | null
  reputationComment: string | null
  source: string | null
  enrollmentQuota: number | null
  acceptingStudents: boolean
  notes: string | null
}

/**
 * @description 导师表单模型。
 */
interface ProfessorFormModel {
  name: string
  university: string
  college: string
  title: string
  researchArea: string
  email: string
  phone: string
  homepage: string
  wechat: string
  schoolRating: string
  acceptingStudents: boolean
  enrollmentQuota: number | null
  source: string
  reputationScore: number
  reputationComment: string
  notes: string
}

/**
 * @description 提交导师信息的数据结构。
 */
interface ProfessorPayload {
  name: string
  university: string
  college: string
  title: string
  researchArea: string
  email: string | null
  phone: string | null
  homepage: string | null
  wechat: string | null
  schoolRating: string
  acceptingStudents: boolean
  enrollmentQuota: number | null
  source: string | null
  reputationScore: number | null
  reputationComment: string | null
  notes: string | null
}

const route = useRoute()
const router = useRouter()
const message = useMessage()

const formRef = ref<FormInst | null>(null)
const loadingDetail = ref(false)
const saving = ref(false)

const titleOptions = [
  { label: '院士', value: '院士' },
  { label: '教授', value: '教授' },
  { label: '副教授', value: '副教授' },
  { label: '讲师', value: '讲师' },
  { label: '研究员', value: '研究员' },
  { label: '副研究员', value: '副研究员' },
  { label: '其他', value: '其他' },
]

const schoolRatingOptions = [
  { label: 'S', value: 'S' },
  { label: 'A', value: 'A' },
  { label: 'B', value: 'B' },
  { label: 'C', value: 'C' },
  { label: 'D', value: 'D' },
]

const formData = reactive<ProfessorFormModel>({
  name: '',
  university: '',
  college: '',
  title: '教授',
  researchArea: '',
  email: '',
  phone: '',
  homepage: '',
  wechat: '',
  schoolRating: 'B',
  acceptingStudents: true,
  enrollmentQuota: null,
  source: '',
  reputationScore: 0,
  reputationComment: '',
  notes: '',
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入姓名', trigger: ['blur', 'input'] }],
  university: [{ required: true, message: '请输入学校', trigger: ['blur', 'input'] }],
  college: [{ required: true, message: '请输入学院', trigger: ['blur', 'input'] }],
  researchArea: [{ required: true, message: '请输入研究方向', trigger: ['blur', 'input'] }],
}

const professorId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const isEdit = computed(() => professorId.value.length > 0)

/**
 * @description 将空字符串转换为 null。
 */
function toNullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * @description 统一提取接口错误信息。
 */
function getApiErrorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback
}

/**
 * @description 构建提交给后端的表单数据。
 */
function buildPayload(): ProfessorPayload {
  return {
    name: formData.name.trim(),
    university: formData.university.trim(),
    college: formData.college.trim(),
    title: formData.title,
    researchArea: formData.researchArea.trim(),
    email: toNullable(formData.email),
    phone: toNullable(formData.phone),
    homepage: toNullable(formData.homepage),
    wechat: toNullable(formData.wechat),
    schoolRating: formData.schoolRating,
    acceptingStudents: formData.acceptingStudents,
    enrollmentQuota: formData.acceptingStudents ? formData.enrollmentQuota : null,
    source: toNullable(formData.source),
    reputationScore: formData.reputationScore > 0 ? formData.reputationScore : null,
    reputationComment: toNullable(formData.reputationComment),
    notes: toNullable(formData.notes),
  }
}

/**
 * @description 编辑场景加载导师详情并回填表单。
 */
async function loadProfessorDetail() {
  if (!isEdit.value) return

  loadingDetail.value = true
  try {
    const response = await professorApi.detail(professorId.value)
    const detail = (response.data as ApiResponse<ProfessorDetail>).data

    formData.name = detail.name ?? ''
    formData.university = detail.university ?? ''
    formData.college = detail.college ?? ''
    formData.title = detail.title ?? '教授'
    formData.researchArea = detail.researchArea ?? ''
    formData.email = detail.email ?? ''
    formData.phone = detail.phone ?? ''
    formData.homepage = detail.homepage ?? ''
    formData.wechat = detail.wechat ?? ''
    formData.schoolRating = detail.schoolRating ?? 'B'
    formData.acceptingStudents = detail.acceptingStudents ?? true
    formData.enrollmentQuota = detail.enrollmentQuota ?? null
    formData.source = detail.source ?? ''
    formData.reputationScore = detail.reputationScore ?? 0
    formData.reputationComment = detail.reputationComment ?? ''
    formData.notes = detail.notes ?? ''
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error, '加载导师信息失败'))
  } finally {
    loadingDetail.value = false
  }
}

/**
 * @description 保存导师信息并返回导师列表。
 */
async function handleSubmit() {
  if (saving.value) return

  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  saving.value = true
  try {
    const payload = buildPayload()

    if (isEdit.value) {
      await professorApi.update(professorId.value, payload)
      message.success('导师信息更新成功')
    } else {
      await professorApi.create(payload)
      message.success('导师信息创建成功')
    }

    await router.push('/professors')
  } catch (error: unknown) {
    message.error(getApiErrorMessage(error, isEdit.value ? '更新导师失败' : '创建导师失败'))
  } finally {
    saving.value = false
  }
}

/**
 * @description 取消编辑并返回导师列表。
 */
async function handleCancel() {
  await router.push('/professors')
}

onMounted(async () => {
  await loadProfessorDetail()
})
</script>

<style scoped>
.professor-form-page {
  gap: 14px;
}

.form-actions {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
