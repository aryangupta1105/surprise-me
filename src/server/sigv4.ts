import { createHash, createHmac } from 'node:crypto'

// AWS Signature V4 query-string presigning (what R2's S3 API accepts). ~30 lines instead of the AWS SDK.
// Checked against AWS's published presigned-URL example in tests/media.test.ts.

const hmac = (k: string | Buffer, s: string) => createHmac('sha256', k).update(s).digest()
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

export type Presign = {
  method: string
  host: string
  path: string // already starting with "/", unencoded
  region: string
  accessKeyId: string
  secretAccessKey: string
  expires: number // seconds
  headers?: Record<string, string> // extra headers the client must send exactly (lower-case names)
  now?: Date
}

export function presignUrl(p: Presign) {
  const amzDate = (p.now ?? new Date()).toISOString().replace(/[-:]|\.\d{3}/g, '')
  const date = amzDate.slice(0, 8)
  const scope = `${date}/${p.region}/s3/aws4_request`
  const headers: Record<string, string> = { ...p.headers, host: p.host }
  const names = Object.keys(headers).sort()
  const signed = names.join(';')
  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${p.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(p.expires),
    'X-Amz-SignedHeaders': signed,
  }
  const qs = Object.keys(query).sort().map((k) => `${enc(k)}=${enc(query[k])}`).join('&')
  const path = p.path.split('/').map(enc).join('/')
  const canonical = [p.method, path, qs, names.map((n) => `${n}:${headers[n].trim()}\n`).join(''), signed, 'UNSIGNED-PAYLOAD'].join('\n')
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha(canonical)].join('\n')
  const key = hmac(hmac(hmac(hmac(`AWS4${p.secretAccessKey}`, date), p.region), 's3'), 'aws4_request')
  return `https://${p.host}${path}?${qs}&X-Amz-Signature=${createHmac('sha256', key).update(toSign).digest('hex')}`
}
