import 'server-only'
import { db } from '@/lib/db'
import { AppError, log } from '@/lib/http'
import { ownedSurprise, shareUrl } from './surprises'
import { runUserAction } from './integrations'
import { emailHtml } from '@/lib/email'

export async function createDelivery(
  surpriseId: string,
  ownerId: string,
  d: { recipientEmail: string; subject: string; message: string; sendAt: Date | null; timezone: string; idempotencyKey: string },
) {
  const existing = await db.delivery.findUnique({ where: { idempotencyKey: d.idempotencyKey } })
  if (existing) {
    if (existing.surpriseId !== surpriseId) throw new AppError(409, 'Duplicate request key.')
    return existing // a repeated click returns the first delivery instead of sending twice
  }
  const s = await ownedSurprise(surpriseId, ownerId)
  if (!shareUrl(s)) throw new AppError(400, 'Publish the surprise (with an active link) before sending it.')
  const scheduledFor = d.sendAt ?? new Date()
  if (d.sendAt && d.sendAt.getTime() < Date.now() - 60_000) throw new AppError(400, 'Pick a time in the future.')
  const delivery = await db.delivery.create({
    data: { surpriseId, recipientEmail: d.recipientEmail, subject: d.subject, message: d.message, scheduledFor, timezone: d.timezone, idempotencyKey: d.idempotencyKey },
  })
  if (!d.sendAt) return sendDelivery(delivery.id)
  return delivery
}

/**
 * Sends one delivery exactly once. The SCHEDULED -> SENDING claim is atomic, so overlapping ticks or a
 * double click cannot both send. A failed send is NOT retried automatically (it may have reached Gmail);
 * the creator retries explicitly, which re-queues it.
 */
export async function sendDelivery(id: string) {
  const claimed = await db.delivery.updateMany({
    where: { id, status: 'SCHEDULED' },
    data: { status: 'SENDING', attempts: { increment: 1 } },
  })
  const d = await db.delivery.findUniqueOrThrow({ where: { id }, include: { surprise: true } })
  if (!claimed.count) return d
  const url = shareUrl(d.surprise)
  try {
    if (!url) throw new Error('The surprise link was revoked before sending.')
    await runUserAction(d.surprise.ownerId, 'gmail', {
      to: d.recipientEmail,
      subject: d.subject,
      messageBody: emailHtml({ message: d.message, url, creatorName: d.surprise.creatorName, recipientName: d.surprise.recipientName }),
      fromName: d.surprise.creatorName,
    })
    return db.delivery.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), lastError: null } })
  } catch (err) {
    const body = (err as { body?: { errorMsg?: unknown } }).body
    const raw = String(body?.errorMsg ? JSON.stringify(body.errorMsg) : (err as Error).message)
    const message = /insufficient authentication scopes|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(raw)
      ? 'Gmail needs one more permission to send. Click Reconnect next to Gmail, allow access, then Retry.'
      : raw.slice(0, 500)
    log('warn', 'delivery failed', { deliveryId: id, error: message })
    return db.delivery.update({ where: { id }, data: { status: 'FAILED', lastError: message } })
  }
}

/** Called by the viaSocket scheduler flow every few minutes. */
export async function processDueDeliveries(now = new Date()) {
  // A send that crashed mid-way is never resent blindly: mark it for the creator to check.
  await db.delivery.updateMany({
    where: { status: 'SENDING', updatedAt: { lt: new Date(now.getTime() - 10 * 60_000) } },
    data: { status: 'FAILED', lastError: 'Sending was interrupted. Check your Gmail Sent folder before retrying.' },
  })
  const due = await db.delivery.findMany({ where: { status: 'SCHEDULED', scheduledFor: { lte: now } }, take: 25, orderBy: { scheduledFor: 'asc' } })
  const results = []
  for (const d of due) results.push(await sendDelivery(d.id))
  return { processed: results.length, sent: results.filter((r) => r.status === 'SENT').length }
}

async function ownedDelivery(id: string, ownerId: string) {
  const d = await db.delivery.findFirst({ where: { id, surprise: { ownerId } } })
  if (!d) throw new AppError(404, 'Delivery not found.')
  return d
}

export async function cancelDelivery(id: string, ownerId: string) {
  await ownedDelivery(id, ownerId)
  const r = await db.delivery.updateMany({ where: { id, status: 'SCHEDULED' }, data: { status: 'CANCELLED' } })
  if (!r.count) throw new AppError(409, 'Only scheduled deliveries can be cancelled.')
}

export async function rescheduleDelivery(id: string, ownerId: string, sendAt: Date, timezone: string) {
  await ownedDelivery(id, ownerId)
  if (sendAt.getTime() < Date.now()) throw new AppError(400, 'Pick a time in the future.')
  const r = await db.delivery.updateMany({
    where: { id, status: { in: ['SCHEDULED', 'CANCELLED', 'FAILED'] } },
    data: { status: 'SCHEDULED', scheduledFor: sendAt, timezone },
  })
  if (!r.count) throw new AppError(409, 'This delivery was already sent.')
}

/** Explicit creator retry of a failed delivery: re-queues and sends now. */
export async function retryDelivery(id: string, ownerId: string) {
  await ownedDelivery(id, ownerId)
  const r = await db.delivery.updateMany({ where: { id, status: 'FAILED' }, data: { status: 'SCHEDULED', scheduledFor: new Date() } })
  if (!r.count) throw new AppError(409, 'Only failed deliveries can be retried.')
  return sendDelivery(id)
}
