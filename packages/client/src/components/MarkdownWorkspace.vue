<template>
  <div class="markdown-workspace">
    <div class="markdown-workspace__toolbar">
      <div class="markdown-workspace__toolbar-groups">
        <div class="markdown-workspace__toolbar-group">
          <n-button size="small" tertiary @click="handleInsertHeading(1)">H1</n-button>
          <n-button size="small" tertiary @click="handleInsertHeading(2)">H2</n-button>
          <n-button size="small" tertiary @click="handleInsertHeading(3)">H3</n-button>
        </div>

        <div class="markdown-workspace__toolbar-group">
          <n-button size="small" tertiary @click="handleWrapSelection('**', '**', '加粗内容')">
            加粗
          </n-button>
          <n-button size="small" tertiary @click="handleWrapSelection('*', '*', '斜体内容')">
            斜体
          </n-button>
          <n-button size="small" tertiary @click="handleWrapSelection('`', '`', '代码')">
            行内代码
          </n-button>
        </div>

        <div class="markdown-workspace__toolbar-group">
          <n-button size="small" tertiary @click="handleInsertQuote">引用</n-button>
          <n-button size="small" tertiary @click="handleInsertBulletList">无序列表</n-button>
          <n-button size="small" tertiary @click="handleInsertOrderedList">有序列表</n-button>
          <n-button size="small" tertiary @click="handleInsertTaskList">任务列表</n-button>
        </div>

        <div class="markdown-workspace__toolbar-group">
          <n-button size="small" tertiary @click="handleInsertLink">链接</n-button>
          <n-button size="small" tertiary @click="handleInsertImage">图片</n-button>
          <n-button size="small" tertiary @click="handleInsertCodeBlock">代码块</n-button>
          <n-button size="small" tertiary @click="handleInsertTable">表格</n-button>
          <n-button size="small" tertiary @click="handleInsertDivider">分割线</n-button>
        </div>
      </div>

      <div class="markdown-workspace__mode-switch">
        <n-button size="small" :type="mode === 'write' ? 'primary' : 'default'" @click="mode = 'write'">
          写作
        </n-button>
        <n-button size="small" :type="mode === 'split' ? 'primary' : 'default'" @click="mode = 'split'">
          分栏
        </n-button>
        <n-button size="small" :type="mode === 'preview' ? 'primary' : 'default'" @click="mode = 'preview'">
          预览
        </n-button>
      </div>
    </div>

    <div class="markdown-workspace__hint">
      <span>像 Typora 一样沉浸写作：工具栏插入 + Markdown 实时预览</span>
      <span>快捷键：Ctrl/Cmd + B、I、K，Ctrl/Cmd + Alt + 1/2/3，Tab / Shift + Tab</span>
    </div>

    <div class="markdown-workspace__body" :class="`markdown-workspace__body--${mode}`">
      <div v-if="mode !== 'preview'" class="markdown-workspace__editor-pane">
        <textarea
          ref="textareaRef"
          :value="modelValue"
          :placeholder="placeholder"
          class="markdown-workspace__textarea"
          :style="{ minHeight }"
          @input="handleTextareaInput"
          @keydown="handleTextareaKeydown"
        />
      </div>

      <div
        v-if="mode !== 'write'"
        class="markdown-workspace__preview-pane"
        :style="{ minHeight }"
      >
        <div
          v-if="modelValue.trim()"
          class="markdown-workspace__preview-content markdown-body"
          v-html="sanitizedHtml"
        />
        <div v-else class="markdown-workspace__preview-empty">
          预览区将在这里显示。可使用标题、任务列表、表格、引用、代码块、图片等 Markdown 语法。
        </div>
      </div>
    </div>

    <div class="markdown-workspace__footer">
      <span>支持：标题 / 列表 / 任务列表 / 表格 / 链接 / 图片 / 引用 / 代码块 / 分割线</span>
      <span>说明：保存逻辑仍由页面负责，笔记与文书编辑体验保持同步</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'

interface Props {
  modelValue: string
  placeholder?: string
  minHeight?: string
}

type WorkspaceMode = 'write' | 'split' | 'preview'
type IndentDirection = 'indent' | 'outdent'

interface SelectionState {
  rawValue: string
  start: number
  end: number
  selectedText: string
}

interface LinePrefixOptions {
  fallbackText: string
  cleanupPattern?: RegExp
  prefixFactory: (index: number) => string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请输入 Markdown 内容',
  minHeight: '520px',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const mode = ref<WorkspaceMode>('split')

marked.setOptions({
  gfm: true,
  breaks: true,
})

const sanitizedHtml = computed(() => {
  const renderedHtml = marked.parse(props.modelValue || '')
  const safeHtml = typeof renderedHtml === 'string' ? renderedHtml : ''
  return DOMPurify.sanitize(safeHtml)
})

/**
 * @description 更新编辑器内容并恢复焦点。
 * @param nextValue 新内容
 * @param selectionStart 选区开始位置
 * @param selectionEnd 选区结束位置
 */
function updateEditorValue(nextValue: string, selectionStart: number, selectionEnd: number) {
  emit('update:modelValue', nextValue)
  void nextTick(() => {
    const textarea = textareaRef.value
    if (!textarea) {
      return
    }

    textarea.focus()
    textarea.selectionStart = selectionStart
    textarea.selectionEnd = selectionEnd
  })
}

/**
 * @description 获取当前选区状态。
 * @returns 当前选区信息
 */
function getSelectionState(): SelectionState {
  const textarea = textareaRef.value
  const rawValue = props.modelValue || ''

  if (!textarea) {
    const endIndex = rawValue.length
    return {
      rawValue,
      start: endIndex,
      end: endIndex,
      selectedText: '',
    }
  }

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  return {
    rawValue,
    start,
    end,
    selectedText: rawValue.slice(start, end),
  }
}

/**
 * @description 获取当前选区覆盖的整行范围。
 * @param rawValue 全量文本
 * @param start 选区开始
 * @param end 选区结束
 * @returns 当前行范围
 */
function getLineRange(rawValue: string, start: number, end: number) {
  const lineStart = rawValue.lastIndexOf('\n', Math.max(start - 1, 0)) + 1
  const safeEnd = end > start && rawValue[end - 1] === '\n' ? end - 1 : end
  const nextLineBreakIndex = rawValue.indexOf('\n', safeEnd)

  return {
    lineStart,
    lineEnd: nextLineBreakIndex === -1 ? rawValue.length : nextLineBreakIndex,
  }
}

/**
 * @description 清理已有 Markdown 前缀，避免重复叠加。
 * @param line 原始行文本
 * @param cleanupPattern 待清理的前缀规则
 * @returns 清理后的行文本
 */
function stripExistingPrefix(line: string, cleanupPattern?: RegExp) {
  if (!cleanupPattern) {
    return line
  }

  const leadingWhitespace = line.match(/^\s*/)?.[0] ?? ''
  const content = line.slice(leadingWhitespace.length).replace(cleanupPattern, '')
  return `${leadingWhitespace}${content}`
}

/**
 * @description 对当前整行内容执行转换。
 * @param fallbackText 无内容时的默认文本
 * @param transformer 行文本转换器
 */
function transformCurrentLines(fallbackText: string, transformer: (lineText: string) => string) {
  const { rawValue, start, end } = getSelectionState()
  const { lineStart, lineEnd } = getLineRange(rawValue, start, end)
  const currentLineText = rawValue.slice(lineStart, lineEnd)
  const sourceText = currentLineText.trim() ? currentLineText : fallbackText
  const transformedText = transformer(sourceText)
  const nextValue = `${rawValue.slice(0, lineStart)}${transformedText}${rawValue.slice(lineEnd)}`

  updateEditorValue(nextValue, lineStart, lineStart + transformedText.length)
}

/**
 * @description 为当前行批量添加 Markdown 前缀。
 * @param options 前缀配置
 */
function prependCurrentLines(options: LinePrefixOptions) {
  transformCurrentLines(options.fallbackText, (sourceText) => {
    const lines = sourceText.trim() ? sourceText.split('\n') : [options.fallbackText]

    return lines
      .map((line, index) => {
        const normalizedLine = stripExistingPrefix(line, options.cleanupPattern)
        const leadingWhitespace = normalizedLine.match(/^\s*/)?.[0] ?? ''
        const content = normalizedLine.slice(leadingWhitespace.length).trimStart()
        const prefix = options.prefixFactory(index)

        return content ? `${leadingWhitespace}${prefix}${content}` : `${leadingWhitespace}${prefix}`
      })
      .join('\n')
  })
}

/**
 * @description 在当前选区插入文本块。
 * @param insertText 要插入的文本
 * @param selectionStartOffset 插入后选区开始偏移
 * @param selectionEndOffset 插入后选区结束偏移
 */
function insertTextBlock(insertText: string, selectionStartOffset: number, selectionEndOffset: number) {
  const { rawValue, start, end } = getSelectionState()
  const nextValue = `${rawValue.slice(0, start)}${insertText}${rawValue.slice(end)}`
  updateEditorValue(nextValue, start + selectionStartOffset, start + selectionEndOffset)
}

/**
 * @description 在选区外包裹 Markdown 语法。
 * @param prefix 前缀
 * @param suffix 后缀
 * @param fallbackText 选区为空时的占位文本
 */
function handleWrapSelection(prefix: string, suffix: string, fallbackText: string) {
  const { rawValue, start, end, selectedText } = getSelectionState()
  const innerText = selectedText || fallbackText
  const nextValue = `${rawValue.slice(0, start)}${prefix}${innerText}${suffix}${rawValue.slice(end)}`
  const selectionStart = start + prefix.length
  const selectionEnd = selectionStart + innerText.length

  updateEditorValue(nextValue, selectionStart, selectionEnd)
}

/**
 * @description 插入标题。
 * @param level 标题级别
 */
function handleInsertHeading(level: number) {
  prependCurrentLines({
    fallbackText: '标题',
    cleanupPattern: /^#{1,6}\s+/,
    prefixFactory: () => `${'#'.repeat(level)} `,
  })
}

/**
 * @description 插入引用。
 */
function handleInsertQuote() {
  prependCurrentLines({
    fallbackText: '引用内容',
    cleanupPattern: /^>\s+/,
    prefixFactory: () => '> ',
  })
}

/**
 * @description 插入无序列表。
 */
function handleInsertBulletList() {
  prependCurrentLines({
    fallbackText: '列表项',
    cleanupPattern: /^[-*+]\s+/,
    prefixFactory: () => '- ',
  })
}

/**
 * @description 插入有序列表。
 */
function handleInsertOrderedList() {
  prependCurrentLines({
    fallbackText: '列表项',
    cleanupPattern: /^\d+\.\s+/,
    prefixFactory: (index) => `${index + 1}. `,
  })
}

/**
 * @description 插入任务列表。
 */
function handleInsertTaskList() {
  prependCurrentLines({
    fallbackText: '待完成事项',
    cleanupPattern: /^- \[(?: |x|X)\]\s+/,
    prefixFactory: () => '- [ ] ',
  })
}

/**
 * @description 插入链接。
 */
function handleInsertLink() {
  handleWrapSelection('[', '](https://example.com)', '链接文本')
}

/**
 * @description 插入图片语法。
 */
function handleInsertImage() {
  const templateText = '![图片描述](https://example.com/image.png)'
  insertTextBlock(templateText, 2, 6)
}

/**
 * @description 插入代码块。
 */
function handleInsertCodeBlock() {
  const { selectedText } = getSelectionState()
  const blockText = selectedText || 'const example = true;'
  const prefix = '```ts\n'
  const suffix = '\n```'
  const insertText = `${prefix}${blockText}${suffix}`
  insertTextBlock(insertText, prefix.length, prefix.length + blockText.length)
}

/**
 * @description 插入表格模板。
 */
function handleInsertTable() {
  const tableTemplate = ['| 列 1 | 列 2 | 列 3 |', '| --- | --- | --- |', '| 内容 | 内容 | 内容 |'].join('\n')
  insertTextBlock(tableTemplate, 2, 5)
}

/**
 * @description 插入分割线。
 */
function handleInsertDivider() {
  insertTextBlock('\n---\n', 5, 5)
}

/**
 * @description 处理输入事件。
 * @param event 输入事件
 */
function handleTextareaInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}

/**
 * @description 处理整行缩进和反缩进。
 * @param direction 缩进方向
 */
function handleLineIndent(direction: IndentDirection) {
  const { rawValue, start, end } = getSelectionState()
  const { lineStart, lineEnd } = getLineRange(rawValue, start, end)
  const lineText = rawValue.slice(lineStart, lineEnd)
  const indentText = '  '
  const nextLineText = lineText
    .split('\n')
    .map((line) => {
      if (direction === 'indent') {
        return `${indentText}${line}`
      }

      if (line.startsWith(indentText)) {
        return line.slice(indentText.length)
      }

      if (line.startsWith('\t')) {
        return line.slice(1)
      }

      if (line.startsWith(' ')) {
        return line.slice(1)
      }

      return line
    })
    .join('\n')

  const nextValue = `${rawValue.slice(0, lineStart)}${nextLineText}${rawValue.slice(lineEnd)}`
  updateEditorValue(nextValue, lineStart, lineStart + nextLineText.length)
}

/**
 * @description 处理编辑器快捷键。
 * @param event 键盘事件
 */
function handleTextareaKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab') {
    event.preventDefault()
    handleLineIndent(event.shiftKey ? 'outdent' : 'indent')
    return
  }

  if (!(event.ctrlKey || event.metaKey)) {
    return
  }

  const key = event.key.toLowerCase()

  if (key === 'b') {
    event.preventDefault()
    handleWrapSelection('**', '**', '加粗内容')
    return
  }

  if (key === 'i') {
    event.preventDefault()
    handleWrapSelection('*', '*', '斜体内容')
    return
  }

  if (key === 'k') {
    event.preventDefault()
    handleInsertLink()
    return
  }

  if (event.altKey && ['1', '2', '3'].includes(key)) {
    event.preventDefault()
    handleInsertHeading(Number(key))
    return
  }

  if (event.shiftKey && key === '8') {
    event.preventDefault()
    handleInsertBulletList()
    return
  }

  if (event.shiftKey && key === '7') {
    event.preventDefault()
    handleInsertOrderedList()
    return
  }

  if (event.shiftKey && key === '9') {
    event.preventDefault()
    handleInsertQuote()
    return
  }

  if (event.shiftKey && key === 'l') {
    event.preventDefault()
    handleInsertTaskList()
    return
  }

  if (event.shiftKey && key === 'c') {
    event.preventDefault()
    handleInsertCodeBlock()
  }
}
</script>

<style scoped>
.markdown-workspace {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background:
    radial-gradient(circle at top left, rgba(96, 165, 250, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.96));
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
}

.markdown-workspace__toolbar {
  position: sticky;
  top: 0;
  z-index: 4;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-bottom: 4px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.72));
  backdrop-filter: blur(12px);
}

.markdown-workspace__toolbar-groups {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.markdown-workspace__toolbar-group {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(248, 250, 252, 0.9);
}

.markdown-workspace__mode-switch {
  display: flex;
  align-items: center;
  gap: 8px;
}

.markdown-workspace__hint,
.markdown-workspace__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #64748b;
}

.markdown-workspace__hint {
  margin-top: -2px;
}

.markdown-workspace__body {
  display: grid;
  gap: 14px;
}

.markdown-workspace__body--write,
.markdown-workspace__body--preview {
  grid-template-columns: 1fr;
}

.markdown-workspace__body--split {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.markdown-workspace__editor-pane,
.markdown-workspace__preview-pane {
  min-width: 0;
}

.markdown-workspace__textarea {
  width: 100%;
  min-height: 520px;
  padding: 22px 24px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(255, 255, 255, 0.98);
  color: #0f172a;
  font-family: 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif;
  font-size: 16px;
  line-height: 1.95;
  resize: vertical;
  outline: none;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
}

.markdown-workspace__textarea::placeholder {
  color: #94a3b8;
}

.markdown-workspace__textarea:focus {
  border-color: rgba(58, 123, 255, 0.42);
  box-shadow:
    0 0 0 3px rgba(58, 123, 255, 0.12),
    0 16px 36px rgba(59, 130, 246, 0.08);
}

.markdown-workspace__preview-pane {
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(255, 255, 255, 0.88);
  overflow: auto;
}

.markdown-workspace__preview-content,
.markdown-workspace__preview-empty {
  padding: 22px 24px;
}

.markdown-workspace__preview-empty {
  color: #64748b;
  font-size: 14px;
  line-height: 1.8;
}

.markdown-body {
  color: #0f172a;
  line-height: 1.85;
  word-break: break-word;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 1.2em 0 0.6em;
  font-weight: 700;
  line-height: 1.3;
}

.markdown-body :deep(h1) {
  font-size: 32px;
}

.markdown-body :deep(h2) {
  font-size: 26px;
}

.markdown-body :deep(h3) {
  font-size: 22px;
}

.markdown-body :deep(p),
.markdown-body :deep(ul),
.markdown-body :deep(ol),
.markdown-body :deep(blockquote),
.markdown-body :deep(table) {
  margin: 0.9em 0;
}

.markdown-body :deep(li) {
  margin: 0.35em 0;
}

.markdown-body :deep(code) {
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.08);
  font-family: Consolas, 'Courier New', monospace;
  font-size: 0.92em;
}

.markdown-body :deep(pre) {
  overflow: auto;
  padding: 16px 18px;
  border-radius: 14px;
  background: #0f172a;
  color: #e2e8f0;
}

.markdown-body :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
}

.markdown-body :deep(blockquote) {
  padding: 10px 16px;
  border-left: 4px solid #60a5fa;
  border-radius: 0 12px 12px 0;
  background: rgba(96, 165, 250, 0.08);
  color: #334155;
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid rgba(148, 163, 184, 0.4);
  margin: 22px 0;
}

.markdown-body :deep(a) {
  color: #2563eb;
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.24);
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 10px 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  text-align: left;
}

.markdown-body :deep(th) {
  background: rgba(241, 245, 249, 0.9);
  font-weight: 600;
}

.markdown-body :deep(img) {
  display: block;
  max-width: 100%;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
}

.markdown-body :deep(input[type='checkbox']) {
  margin-right: 8px;
}

@media (max-width: 960px) {
  .markdown-workspace {
    padding: 14px;
    border-radius: 20px;
  }

  .markdown-workspace__body--split {
    grid-template-columns: 1fr;
  }

  .markdown-workspace__textarea,
  .markdown-workspace__preview-content,
  .markdown-workspace__preview-empty {
    padding: 18px 16px;
  }
}
</style>
