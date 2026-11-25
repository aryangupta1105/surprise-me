'use client'

import { api } from '@/components/ui'

export type MediaKind = 'image' | 'audio' | 'video'
export const ACCEPT: Record<MediaKind, string> = {
  image: 'image/*',
  audio: 'audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,audio/webm',
  video: 'video/mp4,video/webm,video/quicktime',
}
const MAX_INPUT_MB: Record<MediaKind, number> = { image: 30, audio: 20, video: 80 }

/** Photos are shrunk in the browser to a 2048 px long edge before upload; GIFs are kept as they are (animation). */
async function shrinkImage(file: Blob): Promise<Blob> {
  if (file.type === 'image/gif') return file
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, 2048 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    // PNG stays PNG (keeps transparency); everything else (incl. HEIC from iPhones) becomes JPEG.
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85))
    const webSafe = /^image\/(jpeg|png|webp)$/.test(file.type)
    return out && (scale < 1 || !webSafe || out.size < file.size) ? out : file
  } catch {
    return file // the server's sniffing decides whether it's acceptable
  }
}

/** Uploads one file to the surprise's media library and returns its id. */
export async function uploadMedia(file: Blob & { name?: string }, surpriseId: string, kind: MediaKind, onProgress?: (f: number) => void): Promise<string> {
  if (file.size > MAX_INPUT_MB[kind] * 1024 * 1024) throw new Error(`That file is over ${MAX_INPUT_MB[kind]} MB.`)
  const body = kind === 'image' ? await shrinkImage(file) : file
  const mime = body.type || (kind === 'image' ? 'image/jpeg' : `${kind}/mp4`)
  const t = await api<{ id: string; url: string; headers: Record<string, string> }>('/api/uploads', {
    body: { surpriseId, kind, mime, size: body.size, name: (file.name ?? '').slice(0, 200) },
  })
  // XHR (not fetch) for upload progress on large videos.
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', t.url)
    for (const [k, v] of Object.entries(t.headers)) xhr.setRequestHeader(k, v)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error('Upload failed — please try again.')))
    xhr.onerror = () => reject(new Error('Upload failed — check your connection and try again.'))
    xhr.send(body)
  })
  await api(`/api/uploads/${t.id}/complete`, { body: {} })
  return t.id
}
