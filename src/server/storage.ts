import 'server-only'
import { createReadStream } from 'node:fs'
import { mkdir, open, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { env } from '@/lib/env'
import { AppError } from '@/lib/http'
import { presignUrl } from './sigv4'

// Object storage for media. Any S3-compatible service (Backblaze B2, Cloudflare R2, …) when the S3_*
// variables are set; otherwise files under DATA_DIR/media (local dev, tests). Browsers upload straight to
// the bucket with a presigned PUT, so large videos never pass through the 256 MB app server.

const s3 = env.S3_ENDPOINT && env.S3_REGION && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
  ? { host: env.S3_ENDPOINT, region: env.S3_REGION, bucket: env.S3_BUCKET, prefix: env.S3_PREFIX, accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
  : null

export const storageDriver = s3 ? 's3' : 'local'
const localRoot = path.resolve(process.env.DATA_DIR ?? './data', 'media')
const localPath = (key: string) => {
  const p = path.resolve(localRoot, key)
  if (!p.startsWith(localRoot + path.sep)) throw new AppError(400, 'Bad media key.')
  return p
}

const sign = (method: string, key: string, expires: number, headers?: Record<string, string>) =>
  presignUrl({ method, host: s3!.host, path: `/${s3!.bucket}/${s3!.prefix}${key}`, region: s3!.region, accessKeyId: s3!.accessKeyId, secretAccessKey: s3!.secretAccessKey, expires, headers })

/** Where the browser PUTs the file. Content-Type and Content-Length are signed, so the bucket rejects anything else. */
export function uploadTarget(key: string, uploadId: string, mime: string, size: number) {
  if (!s3) return { url: `/api/uploads/${uploadId}/blob`, headers: { 'Content-Type': mime } }
  return { url: sign('PUT', key, 900, { 'content-type': mime, 'content-length': String(size) }), headers: { 'Content-Type': mime } }
}

/** Total size and the first bytes (for content sniffing), or null if the object is missing. */
export async function head(key: string): Promise<{ size: number; first: Uint8Array } | null> {
  if (!s3) {
    try {
      const fh = await open(localPath(key))
      try {
        const buf = new Uint8Array(32)
        const { bytesRead } = await fh.read(buf, 0, 32, 0)
        return { size: (await fh.stat()).size, first: buf.slice(0, bytesRead) }
      } finally {
        await fh.close()
      }
    } catch {
      return null
    }
  }
  const res = await fetch(sign('GET', key, 60), { headers: { Range: 'bytes=0-31' } })
  if (res.status === 404) return null
  if (!res.ok) throw new AppError(502, 'Could not reach media storage.')
  const total = Number(res.headers.get('content-range')?.split('/')[1] ?? res.headers.get('content-length'))
  return { size: total, first: new Uint8Array(await res.arrayBuffer()).slice(0, 32) }
}

export async function remove(key: string) {
  if (!s3) return rm(localPath(key), { force: true })
  const res = await fetch(sign('DELETE', key, 60), { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new AppError(502, 'Could not delete from media storage.')
}

/** Local driver only: stream the request body to disk, refusing anything past `max` bytes. */
export async function writeLocal(key: string, body: ReadableStream<Uint8Array>, max: number) {
  const file = localPath(key)
  await mkdir(path.dirname(file), { recursive: true })
  const fh = await open(file, 'w')
  let n = 0
  try {
    for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
      n += chunk.length
      if (n > max) throw new AppError(413, 'That file is larger than it said it was.')
      await fh.write(chunk)
    }
  } catch (e) {
    await fh.close()
    await rm(file, { force: true })
    throw e
  }
  await fh.close()
}

const MEDIA_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' }

/** Serves a stored object: a short-lived redirect to the bucket, or a local file with Range support (video seeking). */
export async function serve(key: string, mime: string, range: string | null): Promise<Response> {
  if (s3) return new Response(null, { status: 302, headers: { Location: sign('GET', key, 3600), 'Cache-Control': 'private, max-age=1800', ...MEDIA_HEADERS } })
  const file = localPath(key)
  const { size } = await stat(file).catch(() => {
    throw new AppError(404, 'Not found.')
  })
  const base = { 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600', ...MEDIA_HEADERS }
  const m = range?.match(/^bytes=(\d*)-(\d*)$/)
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]))
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream
    return new Response(stream, { status: 206, headers: { ...base, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${size}` } })
  }
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers: { ...base, 'Content-Length': String(size) } })
}
