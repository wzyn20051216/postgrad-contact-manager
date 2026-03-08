import type { Prisma } from '@prisma/client'
import { NextFunction, Request, Response } from 'express'
import { prisma } from '../config/database.js'
import { error, success } from '../utils/response.js'

interface ImportDataBody {
  professors?: ImportedProfessor[]
}

interface ImportedTagPayload {
  name?: unknown
  color?: unknown
}

interface ImportedProfessorTag {
  name?: unknown
  color?: unknown
  tag?: ImportedTagPayload
}

interface ImportedInterview {
  scheduledAt?: unknown
  duration?: unknown
  method?: unknown
  location?: unknown
  meetingLink?: unknown
  status?: unknown
  preparationNotes?: unknown
}

interface ImportedProfessor {
  name?: unknown
  university?: unknown
  college?: unknown
  title?: unknown
  researchArea?: unknown
  email?: unknown
  phone?: unknown
  homepage?: unknown
  wechat?: unknown
  schoolRating?: unknown
  reputationScore?: unknown
  reputationComment?: unknown
  contactStatus?: unknown
  priority?: unknown
  source?: unknown
  enrollmentQuota?: unknown
  acceptingStudents?: unknown
  notes?: unknown
  tags?: ImportedProfessorTag[]
  interviews?: ImportedInterview[]
}

/** @description 将输入值转换为去空白字符串 */
function toTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const result = value.trim()
  return result ? result : undefined
}

/** @description 将输入值转换为整数 */
function toInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return undefined
  }
  return value
}

/** @description 将输入值转换为日期 */
function toDate(value: unknown): Date | undefined {
  if (!(typeof value === 'string' || value instanceof Date)) {
    return undefined
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }
  return parsed
}

export class DataController {
  /** @description 导出当前用户所有导师数据（包含 tags、interviews） */
  async exportData(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return error(res, '未登录', 401)
      }

      const userId = req.user.id
      const professors = await prisma.professor.findMany({
        where: { userId },
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
          interviews: true,
        },
      })
      const resources = await prisma.resourceLink.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      })

      return success(res, { professors, resources })
    } catch (err) {
      return next(err)
    }
  }

  /** @description 批量导入导师数据（按 email 或 name+university 判重） */
  async importData(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return error(res, '未登录', 401)
      }

      const userId = req.user.id
      const body = req.body as ImportDataBody

      if (!Array.isArray(body.professors)) {
        return error(res, 'professors 必须是数组', 400)
      }

      let importedCount = 0

      for (const item of body.professors) {
        const createData = this.buildProfessorCreateData(userId, item)
        if (!createData) {
          continue
        }

        const exists = await prisma.professor.findFirst({
          where: createData.email
            ? {
                userId,
                OR: [
                  { email: createData.email },
                  { name: createData.name, university: createData.university },
                ],
              }
            : {
                userId,
                name: createData.name,
                university: createData.university,
              },
          select: { id: true },
        })

        if (exists) {
          continue
        }

        const created = await prisma.professor.create({
          data: createData,
          select: { id: true },
        })

        await this.importTags(userId, created.id, item.tags)
        await this.importInterviews(created.id, item.interviews)
        importedCount += 1
      }

      return success(res, { importedCount }, '导入完成')
    } catch (err) {
      return next(err)
    }
  }

  /** @description 清空当前用户所有数据（导师、面试、标签、笔记、提醒、模板） */
  async clearData(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return error(res, '未登录', 401)
      }

      const userId = req.user.id

      await prisma.$transaction(async (tx) => {
        const professors = await tx.professor.findMany({
          where: { userId },
          select: { id: true },
        })

        const professorIds = professors.map((professor) => professor.id)

        if (professorIds.length > 0) {
          await tx.interview.deleteMany({
            where: {
              professorId: { in: professorIds },
            },
          })

          await tx.tagOnProfessor.deleteMany({
            where: {
              professorId: { in: professorIds },
            },
          })
        }

        await tx.note.deleteMany({ where: { userId } })
        await tx.reminder.deleteMany({ where: { userId } })
        await tx.emailTemplate.deleteMany({ where: { userId } })
        await tx.resourceLink.deleteMany({ where: { userId } })
        await tx.resourceHealthReport.deleteMany({ where: { userId } })
        await tx.tag.deleteMany({ where: { userId } })
        await tx.professor.deleteMany({ where: { userId } })
      })

      return success(res, null, '数据清空成功')
    } catch (err) {
      return next(err)
    }
  }

  /** @description 组装导师创建参数 */
  private buildProfessorCreateData(userId: string, item: ImportedProfessor): Prisma.ProfessorUncheckedCreateInput | null {
    const name = toTrimmedString(item.name)
    const university = toTrimmedString(item.university)
    const college = toTrimmedString(item.college)
    const researchArea = toTrimmedString(item.researchArea)

    if (!name || !university || !college || !researchArea) {
      return null
    }

    const data: Prisma.ProfessorUncheckedCreateInput = {
      userId,
      name,
      university,
      college,
      researchArea,
    }

    const title = toTrimmedString(item.title)
    const email = toTrimmedString(item.email)
    const phone = toTrimmedString(item.phone)
    const homepage = toTrimmedString(item.homepage)
    const wechat = toTrimmedString(item.wechat)
    const schoolRating = toTrimmedString(item.schoolRating)
    const reputationComment = toTrimmedString(item.reputationComment)
    const contactStatus = toTrimmedString(item.contactStatus)
    const source = toTrimmedString(item.source)
    const notes = toTrimmedString(item.notes)

    if (title) data.title = title
    if (email) data.email = email
    if (phone) data.phone = phone
    if (homepage) data.homepage = homepage
    if (wechat) data.wechat = wechat
    if (schoolRating) data.schoolRating = schoolRating
    if (reputationComment) data.reputationComment = reputationComment
    if (contactStatus) data.contactStatus = contactStatus
    if (source) data.source = source
    if (notes) data.notes = notes

    const reputationScore = toInteger(item.reputationScore)
    const priority = toInteger(item.priority)
    const enrollmentQuota = toInteger(item.enrollmentQuota)

    if (reputationScore !== undefined) data.reputationScore = reputationScore
    if (priority !== undefined) data.priority = priority
    if (enrollmentQuota !== undefined) data.enrollmentQuota = enrollmentQuota

    if (typeof item.acceptingStudents === 'boolean') {
      data.acceptingStudents = item.acceptingStudents
    }

    return data
  }

  /** @description 导入导师标签并自动复用已有标签 */
  private async importTags(userId: string, professorId: string, tags: ImportedProfessorTag[] | undefined) {
    if (!Array.isArray(tags) || tags.length === 0) {
      return
    }

    const linkedTagIds = new Set<string>()

    for (const item of tags) {
      const name = toTrimmedString(item.tag?.name) ?? toTrimmedString(item.name)
      if (!name) {
        continue
      }

      const color = toTrimmedString(item.tag?.color) ?? toTrimmedString(item.color)

      const existingTag = await prisma.tag.findFirst({
        where: { userId, name },
        select: { id: true },
      })

      const tag = existingTag
        ? existingTag
        : await prisma.tag.create({
            data: {
              userId,
              name,
              ...(color ? { color } : {}),
            },
            select: { id: true },
          })

      if (linkedTagIds.has(tag.id)) {
        continue
      }

      linkedTagIds.add(tag.id)

      await prisma.tagOnProfessor.upsert({
        where: {
          professorId_tagId: {
            professorId,
            tagId: tag.id,
          },
        },
        update: {},
        create: {
          professorId,
          tagId: tag.id,
        },
      })
    }
  }

  /** @description 导入导师关联面试记录 */
  private async importInterviews(professorId: string, interviews: ImportedInterview[] | undefined) {
    if (!Array.isArray(interviews) || interviews.length === 0) {
      return
    }

    for (const item of interviews) {
      const scheduledAt = toDate(item.scheduledAt)
      if (!scheduledAt) {
        continue
      }

      const data: Prisma.InterviewUncheckedCreateInput = {
        professorId,
        scheduledAt,
      }

      const method = toTrimmedString(item.method)
      const location = toTrimmedString(item.location)
      const meetingLink = toTrimmedString(item.meetingLink)
      const status = toTrimmedString(item.status)
      const preparationNotes = toTrimmedString(item.preparationNotes)
      const duration = toInteger(item.duration)

      if (duration !== undefined) data.duration = duration
      if (method) data.method = method
      if (location) data.location = location
      if (meetingLink) data.meetingLink = meetingLink
      if (status) data.status = status
      if (preparationNotes) data.preparationNotes = preparationNotes

      await prisma.interview.create({ data })
    }
  }
}
