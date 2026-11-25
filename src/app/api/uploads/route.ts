import { db } from '@/lib/db'
import { AppError, rateLimit, route } from '@/lib/http'
import { ensureUser } from '@/lib/session'

const MAX_BYTES = 3 * 1024 * 1024
// Content is sniffed from magic bytes: the browser's declared type is not trusted.
function sniff(b: Uint8Array) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp'
  if (String.fromCharCode(...b.slice(0, 3)) === 'GIF') return 'image/gif'
  return null
}

export const POST = route(async (req) => {
  rateLimit(req, 'upload', 30, 60_000)
  const form = await req.formData()
  const file = form.get('file')
  const surpriseId = String(form.get('surpriseId') ?? '')
  if (!(file instanceof File)) throw new AppError(400, 'No file received.')
  if (file.size > MAX_BYTES) throw new AppError(413, 'Photos must be under 3 MB.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const mime = sniff(bytes)
  if (!mime) throw new AppError(415, 'Only JPEG, PNG, WebP or GIF photos are allowed.')
  const user = await ensureUser()
  if (!(await db.surprise.findFirst({ where: { id: surpriseId, ownerId: user.id } }))) throw new AppError(404, 'Surprise not found.')
  const count = await db.upload.count({ where: { surpriseId } })
  if (count >= 12) throw new AppError(400, 'A surprise can hold up to 12 photos.')
  const up = await db.upload.create({ data: { ownerId: user.id, surpriseId, mime, size: bytes.length, data: bytes } })
  return { id: up.id }
})
