import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DEFAULT_OUTPUT_PATH = path.resolve('scripts/data/graduate-school-sources.snapshot.json')

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
 * @description 规范化字符串，避免导出脏数据。
 * @param {string | null | undefined} value 原始值
 * @returns {string} 处理后的文本
 */
function normalizeText(value) {
  return String(value ?? '').trim()
}

/**
 * @description 构建快照元数据。
 * @param {Array<Record<string, unknown>>} records 官方源记录
 * @returns {Record<string, unknown>} 元数据对象
 */
function buildMetadata(records) {
  const unitNames = new Set(records.map((item) => normalizeText(item.schoolName)))

  return {
    exportedAt: new Date().toISOString(),
    source: '中国研究生招生信息网院校库官方链接快照',
    totalSources: records.length,
    totalUnits: unitNames.size,
    scope: '全国研招单位（含高校、研究所等）官方源',
  }
}

/**
 * @description 导出学校官方源快照。
 */
async function main() {
  const outputPath = path.resolve(readArg('output') || DEFAULT_OUTPUT_PATH)
  const records = await prisma.schoolOfficialSource.findMany({
    orderBy: [{ schoolName: 'asc' }, { priority: 'desc' }, { siteName: 'asc' }, { baseUrl: 'asc' }],
    select: {
      schoolName: true,
      siteName: true,
      baseUrl: true,
      domain: true,
      description: true,
      priority: true,
      isActive: true,
    },
  })

  const normalizedRecords = records.map((item) => ({
    schoolName: normalizeText(item.schoolName),
    siteName: normalizeText(item.siteName),
    baseUrl: normalizeText(item.baseUrl),
    domain: normalizeText(item.domain),
    description: normalizeText(item.description),
    priority: Number(item.priority) || 0,
    isActive: Boolean(item.isActive),
  }))

  const snapshot = {
    metadata: buildMetadata(normalizedRecords),
    records: normalizedRecords,
  }

  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  console.log(`[snapshot] 已导出 ${normalizedRecords.length} 条官方源 -> ${outputPath}`)
}

main()
  .catch((error) => {
    console.error('[snapshot] 导出失败：', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
