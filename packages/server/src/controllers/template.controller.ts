import { NextFunction, Request, Response } from 'express'
import type { Dirent } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, relative, resolve } from 'node:path'
import { prisma } from '../config/database.js'
import { errorResponse, successResponse } from '../utils/response.js'

interface TemplateBody {
  name?: unknown
  subject?: unknown
  content?: unknown
  category?: unknown
}

interface TemplateImportFolderBody {
  folderPath?: unknown
  recursive?: unknown
}

interface ImportedFile {
  absolutePath: string
  relativePath: string
  displayName: string
  extension: string
  previewContent: string
  category: string
}

const MAX_IMPORT_FILES = 200
const MAX_IMPORT_DEPTH = 5
const MAX_TEXT_FILE_BYTES = 1024 * 1024
const MAX_PREVIEW_LENGTH = 3000

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.yaml',
  '.yml',
  '.csv',
  '.log',
  '.rtf',
])

/**
 * @description 将输入值转换为去空格字符串。
 * @param value 输入值
 * @returns 标准化字符串
 */
function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * @description 将输入值转换为必填非空字符串。
 * @param value 输入值
 * @returns 非空字符串，失败返回 null
 */
function toRequiredString(value: unknown): string | null {
  const text = toTrimmedString(value)
  return text ? text : null
}

/**
 * @description 将输入值转为布尔值。
 * @param value 输入值
 * @param fallback 默认值
 * @returns 布尔值
 */
function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return fallback
}

/**
 * @description 解析系统默认文档目录。
 * @returns 默认目录路径，解析失败返回 null
 */
function resolveSystemDefaultFolderPath(): string | null {
  const userProfile = toRequiredString(process.env.USERPROFILE)
  if (userProfile) {
    return resolve(userProfile, 'Documents')
  }

  const homePath = toRequiredString(process.env.HOME)
  if (homePath) {
    return resolve(homePath, 'Documents')
  }

  return null
}

/**
 * @description 截断字符串到指定长度。
 * @param value 原始字符串
 * @param maxLength 最大长度
 * @returns 截断后的字符串
 */
function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength)}\n...(内容已截断)`
}

/**
 * @description 根据文件名推断文书分类。
 * @param filePath 文件路径文本
 * @returns 分类编码
 */
function inferCategoryByPath(filePath: string): string {
  const lowerPath = filePath.toLowerCase()

  if (
    lowerPath.includes('简历') ||
    lowerPath.includes('resume') ||
    lowerPath.includes('cv')
  ) {
    return 'RESUME'
  }
  if (
    lowerPath.includes('成绩单') ||
    lowerPath.includes('transcript') ||
    lowerPath.includes('grade')
  ) {
    return 'TRANSCRIPT'
  }
  if (
    lowerPath.includes('个人陈述') ||
    lowerPath.includes('personal statement') ||
    lowerPath.includes('ps')
  ) {
    return 'PERSONAL_STATEMENT'
  }
  if (
    lowerPath.includes('推荐信') ||
    lowerPath.includes('recommendation')
  ) {
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
 * @description 读取文本文件预览内容。
 * @param absolutePath 文件绝对路径
 * @returns 预览文本
 */
async function readTextPreview(absolutePath: string): Promise<string | null> {
  try {
    const fileStat = await stat(absolutePath)
    if (!fileStat.isFile()) {
      return null
    }
    if (fileStat.size > MAX_TEXT_FILE_BYTES) {
      return '文本文件较大，已跳过全文读取，请在本地打开原文件查看。'
    }

    const content = await readFile(absolutePath, 'utf8')
    const trimmed = content.trim()
    if (!trimmed) {
      return '文件内容为空。'
    }
    return truncateText(trimmed, MAX_PREVIEW_LENGTH)
  } catch {
    return null
  }
}

/**
 * @description 生成导入后的内容摘要。
 * @param relativePath 相对路径
 * @param extension 扩展名
 * @param textPreview 文本预览
 * @returns 摘要文本
 */
function buildPreviewContent(relativePath: string, extension: string, textPreview: string | null): string {
  const header = `来源文件：${relativePath}`

  if (textPreview) {
    return `${header}\n\n${textPreview}`
  }

  const extensionText = extension ? extension : '未知类型'
  return `${header}\n\n文件类型：${extensionText}\n提示：该文件可能为二进制文档，请在本地打开原文件查看。`
}

/**
 * @description 按目录收集可导入文件。
 * @param rootPath 根目录绝对路径
 * @param recursive 是否递归
 * @returns 文件列表
 */
async function collectFilesForImport(rootPath: string, recursive: boolean): Promise<ImportedFile[]> {
  const result: ImportedFile[] = []
  const queue: Array<{ dir: string; depth: number }> = [{ dir: rootPath, depth: 0 }]

  while (queue.length > 0 && result.length < MAX_IMPORT_FILES) {
    const current = queue.shift()
    if (!current) {
      break
    }

    let entries: Dirent[]
    try {
      entries = await readdir(current.dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (result.length >= MAX_IMPORT_FILES) {
        break
      }

      const absolutePath = resolve(current.dir, entry.name)
      if (entry.isDirectory()) {
        if (recursive && current.depth < MAX_IMPORT_DEPTH) {
          queue.push({ dir: absolutePath, depth: current.depth + 1 })
        }
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      const extension = extname(entry.name).toLowerCase()
      const fileNameWithoutExt = extension
        ? entry.name.slice(0, entry.name.length - extension.length)
        : entry.name
      const displayName = fileNameWithoutExt.trim() || entry.name
      const relativePath = relative(rootPath, absolutePath) || entry.name
      const textPreview = TEXT_EXTENSIONS.has(extension)
        ? await readTextPreview(absolutePath)
        : null

      result.push({
        absolutePath,
        relativePath,
        displayName: truncateText(displayName, 60),
        extension,
        previewContent: buildPreviewContent(relativePath, extension, textPreview),
        category: inferCategoryByPath(`${relativePath} ${displayName}`),
      })
    }
  }

  return result
}

export class TemplateController {
  /** @description 获取文书资料列表 */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, '未登录', 401)
      const { category } = req.query
      const templates = await prisma.emailTemplate.findMany({
        where: {
          userId: req.user.id,
          ...(category ? { category: String(category) } : {}),
        },
        orderBy: { updatedAt: 'desc' },
      })
      return successResponse(res, templates)
    } catch (err) {
      return next(err)
    }
  }

  /** @description 获取文书资料详情 */
  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, '未登录', 401)
      const template = await prisma.emailTemplate.findFirst({
        where: { id: String(req.params.id), userId: req.user.id },
      })
      if (!template) return errorResponse(res, '文书资料不存在', 404)
      return successResponse(res, template)
    } catch (err) {
      return next(err)
    }
  }

  /** @description 创建文书资料 */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, '未登录', 401)
      const body = req.body as TemplateBody
      const name = toRequiredString(body.name)
      const subject = toTrimmedString(body.subject)
      const content = toTrimmedString(body.content)
      const category = toTrimmedString(body.category) || 'OTHER_DOC'

      if (!name) {
        return errorResponse(res, 'name 不能为空', 400)
      }
      if (!subject && !content) {
        return errorResponse(res, '文件路径/链接 与 内容摘要不能同时为空', 400)
      }

      const template = await prisma.emailTemplate.create({
        data: { userId: req.user.id, name, subject, content, category },
      })
      return successResponse(res, template, '创建成功')
    } catch (err) {
      return next(err)
    }
  }

  /** @description 批量从本地目录导入文书 */
  async importFolder(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, '未登录', 401)
      const userId = req.user.id

      const body = req.body as TemplateImportFolderBody
      const folderPathInput = toTrimmedString(body.folderPath)
      const recursive = toBoolean(body.recursive, true)
      const folderPath = folderPathInput
        ? resolve(folderPathInput)
        : resolveSystemDefaultFolderPath()
      if (!folderPath) {
        return errorResponse(res, 'folderPath 为空且系统默认文档目录不可用', 400)
      }

      let folderStat: Awaited<ReturnType<typeof stat>>
      try {
        folderStat = await stat(folderPath)
      } catch {
        return errorResponse(res, '目录不存在或不可访问', 400)
      }

      if (!folderStat.isDirectory()) {
        return errorResponse(res, 'folderPath 必须是目录', 400)
      }

      const files = await collectFilesForImport(folderPath, recursive)
      if (files.length === 0) {
        return successResponse(
          res,
          {
            folderPath,
            recursive,
            scannedCount: 0,
            createdCount: 0,
            duplicateCount: 0,
            reachedLimit: false,
          },
          '目录中未发现可导入文件'
        )
      }

      const requestPathSet = new Set<string>()
      const deduplicatedFiles: ImportedFile[] = []
      let duplicateInRequest = 0

      for (const item of files) {
        if (requestPathSet.has(item.absolutePath)) {
          duplicateInRequest += 1
          continue
        }
        requestPathSet.add(item.absolutePath)
        deduplicatedFiles.push(item)
      }

      const existingRows = await prisma.emailTemplate.findMany({
        where: {
          userId,
          subject: {
            in: deduplicatedFiles.map((item) => item.absolutePath),
          },
        },
        select: {
          subject: true,
        },
      })
      const existingPathSet = new Set(existingRows.map((item) => item.subject))

      const createData = deduplicatedFiles
        .filter((item) => !existingPathSet.has(item.absolutePath))
        .map((item) => ({
          userId,
          name: item.displayName,
          subject: item.absolutePath,
          content: item.previewContent,
          category: item.category,
        }))

      if (createData.length > 0) {
        await prisma.emailTemplate.createMany({ data: createData })
      }

      const duplicateInDatabase = deduplicatedFiles.length - createData.length
      return successResponse(
        res,
        {
          folderPath,
          recursive,
          scannedCount: files.length,
          createdCount: createData.length,
          duplicateCount: duplicateInRequest + duplicateInDatabase,
          reachedLimit: files.length >= MAX_IMPORT_FILES,
          maxImportFiles: MAX_IMPORT_FILES,
        },
        createData.length > 0 ? '目录导入完成' : '没有新增文书资料'
      )
    } catch (err) {
      return next(err)
    }
  }

  /** @description 更新文书资料 */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, '未登录', 401)
      const userId = req.user.id
      const id = String(req.params.id)
      const exists = await prisma.emailTemplate.findFirst({
        where: { id, userId },
        select: { id: true, subject: true, content: true },
      })
      if (!exists) return errorResponse(res, '文书资料不存在', 404)

      const body = req.body as TemplateBody
      const data: Record<string, string> = {}
      if (body.name !== undefined) data.name = toTrimmedString(body.name)
      if (body.subject !== undefined) data.subject = toTrimmedString(body.subject)
      if (body.content !== undefined) data.content = toTrimmedString(body.content)
      if (body.category !== undefined) data.category = toTrimmedString(body.category)

      if (Object.keys(data).length === 0) {
        return errorResponse(res, '至少提供一个可更新字段', 400)
      }
      if ('name' in data && !data.name) {
        return errorResponse(res, 'name 不能为空', 400)
      }

      const finalSubject = data.subject !== undefined
        ? data.subject
        : exists.subject || ''
      const finalContent = data.content !== undefined
        ? data.content
        : exists.content || ''

      if (!finalSubject && !finalContent) {
        return errorResponse(res, '文件路径/链接 与 内容摘要不能同时为空', 400)
      }

      const template = await prisma.emailTemplate.update({ where: { id }, data })
      return successResponse(res, template, '更新成功')
    } catch (err) {
      return next(err)
    }
  }

  /** @description 删除文书资料 */
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return errorResponse(res, '未登录', 401)
      const id = String(req.params.id)
      const exists = await prisma.emailTemplate.findFirst({
        where: { id, userId: req.user.id },
        select: { id: true },
      })
      if (!exists) return errorResponse(res, '文书资料不存在', 404)
      await prisma.emailTemplate.delete({ where: { id } })
      return successResponse(res, null, '删除成功')
    } catch (err) {
      return next(err)
    }
  }
}
