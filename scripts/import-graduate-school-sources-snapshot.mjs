import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DEFAULT_INPUT_PATH = path.resolve('scripts/data/graduate-school-sources.snapshot.json')

/**
 * @description 读取命令行参数。
 * @param {string} key 参数名
 * @returns {string | undefined} 参数值
 */
function readArg(key) {
  const direct = process.argv.find((item) => item.startsWith(`--${key}=`))
  if (direct) {
    return direct.slice(key.length + 3)
  }

  const index = process.argv.findIndex((item) => item === `--${key}`)
  if (index >= 0) {
    return process.argv[index + 1]
  }

  return undefined
}

/**
 * @description 规范化文本字段。
 * @param {string | null | undefined} value 原始值
 * @returns {string} 处理后的文本
 */
function normalizeText(value) {
  return String(value ?? '').trim()
}

/**
 * @description 校验并规范化快照记录。
 * @param {unknown} value 原始记录
 * @returns {{schoolName: string, siteName: string, baseUrl: string, domain: string, description: string, priority: number, isActive: boolean}}
 */
function normalizeRecord(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('快照记录格式无效')
  }

  const record = /** @type {Record<string, unknown>} */ (value)
  const schoolName = normalizeText(record.schoolName)
  const siteName = normalizeText(record.siteName)
  const baseUrl = normalizeText(record.baseUrl)
  const domain = normalizeText(record.domain)
  const description = normalizeText(record.description)
  const priority = Number(record.priority) || 0
  const isActive = record.isActive !== false

  if (!schoolName || !siteName || !baseUrl || !domain) {
    throw new Error(`快照记录缺少必填字段：${JSON.stringify(record)}`)
  }

  return {
    schoolName,
    siteName,
    baseUrl,
    domain,
    description,
    priority,
    isActive,
  }
}

/**
 * @description 将快照记录写入数据库。
 * @param {{schoolName: string, siteName: string, baseUrl: string, domain: string, description: string, priority: number, isActive: boolean}} record 快照记录
 */
async function upsertRecord(record) {
  await prisma.schoolOfficialSource.upsert({
    where: {
      baseUrl: record.baseUrl,
    },
    update: {
      schoolName: record.schoolName,
      siteName: record.siteName,
      domain: record.domain,
      description: record.description,
      priority: record.priority,
      isActive: record.isActive,
    },
    create: {
      schoolName: record.schoolName,
      siteName: record.siteName,
      baseUrl: record.baseUrl,
      domain: record.domain,
      description: record.description,
      priority: record.priority,
      isActive: record.isActive,
    },
  })
}

/**
 * @description 从项目内快照恢复全国研招单位官方源。
 */
async function main() {
  const inputPath = path.resolve(readArg('input') || DEFAULT_INPUT_PATH)
  const snapshotText = await readFile(inputPath, 'utf8')
  const snapshot = JSON.parse(snapshotText)
  const records = Array.isArray(snapshot.records) ? snapshot.records : []

  if (records.length === 0) {
    throw new Error(`快照中没有可导入的数据：${inputPath}`)
  }

  let importedCount = 0
  for (const item of records) {
    const record = normalizeRecord(item)
    await upsertRecord(record)
    importedCount += 1
  }

  const finalCount = await prisma.schoolOfficialSource.count()
  console.log(
    JSON.stringify(
      {
        snapshotPath: inputPath,
        snapshotCount: records.length,
        importedCount,
        finalCount,
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error('[snapshot] 导入失败：', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
