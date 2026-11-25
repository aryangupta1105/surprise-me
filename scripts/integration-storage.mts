// Live check of the S3-compatible storage driver (B2/R2) with a throwaway object. Prints no secrets.
// node --env-file=.env --conditions=react-server --import tsx scripts/integration-storage.mts
import * as storage from '../src/server/storage.ts'

const key = `test/integration-${Date.now()}.png`
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 56 }, (_, i) => i)])
const ok = (name: string, pass: boolean, extra = '') => console.log(`${pass ? 'PASS' : 'FAIL'} ${name} ${extra}`)

console.log('driver:', storage.storageDriver)
const t = storage.uploadTarget(key, 'x', 'image/png', png.length)
const put = await fetch(t.url, { method: 'PUT', headers: t.headers, body: png })
ok('presigned PUT', put.ok, String(put.status))

const wrong = await fetch(storage.uploadTarget(key + '-2', 'x', 'image/png', png.length).url, { method: 'PUT', headers: { 'Content-Type': 'text/html' }, body: png })
ok('PUT with a different Content-Type is refused', !wrong.ok, String(wrong.status))

const h = await storage.head(key)
ok('head: size + first bytes', h?.size === png.length && h.first[1] === 0x50, JSON.stringify({ size: h?.size, first: h?.first.length }))

const redirect = await storage.serve(key, 'image/png', null)
const loc = redirect.headers.get('location') ?? ''
const ranged = await fetch(loc, { headers: { Range: 'bytes=8-11' } })
const part = new Uint8Array(await ranged.arrayBuffer())
ok('signed GET redirect + Range', redirect.status === 302 && ranged.status === 206 && part.join() === '0,1,2,3', String(ranged.status))

await storage.remove(key)
ok('delete', (await storage.head(key)) === null)
ok('missing object -> null', (await storage.head('test/does-not-exist')) === null)
