import 'server-only'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '@/generated/prisma/client'
import { env } from './env'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function create() {
  if (env.DATABASE_URL.startsWith('file:')) mkdirSync(dirname(env.DATABASE_URL.slice(5)), { recursive: true })
  return new PrismaClient({ adapter: new PrismaLibSql({ url: env.DATABASE_URL }) })
}

export const db = globalForPrisma.prisma ?? create()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
