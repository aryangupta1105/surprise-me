import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { env } from './env'

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

const key = () => createHash('sha256').update(`enc:${env.APP_SECRET}`).digest()

export function encrypt(plain: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.')
}

export function decrypt(payload: string) {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
