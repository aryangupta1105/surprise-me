import { db } from '@/lib/db'
import { route } from '@/lib/http'
import { requireUser } from '@/lib/session'
import { draftDoc } from '@/server/surprises'

/** Everything a person made, as one JSON download (their copy, and a safety net). Media files are referenced by id. */
export const GET = route(async () => {
  const user = await requireUser()
  const surprises = await db.surprise.findMany({ where: { ownerId: user.id }, include: { reactions: true, contributions: true, deliveries: { select: { recipientEmail: true, subject: true, status: true, scheduledFor: true } } } })
  const out = {
    exportedAt: new Date().toISOString(),
    account: { email: user.email, name: user.name, isGuest: user.isGuest, createdAt: user.createdAt },
    surprises: await Promise.all(
      surprises.map(async (s) => ({
        title: s.title, recipientName: s.recipientName, creatorName: s.creatorName, occasion: s.occasion, status: s.status, createdAt: s.createdAt,
        document: await draftDoc(s).catch(() => null),
        reactions: s.reactions.map((r) => ({ emoji: r.emoji, message: r.message, fromName: r.fromName, at: r.createdAt })),
        messagesFromFriends: s.contributions.map((c) => ({ name: c.name, message: c.message, status: c.status })),
        emails: s.deliveries,
      })),
    ),
  }
  return new Response(JSON.stringify(out, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="surpriseme-export.json"', 'Cache-Control': 'no-store' },
  })
})
