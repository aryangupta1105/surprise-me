// Shared by the server (sending) and the studio (preview), so both show the same email.
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** The email body. Creator text is escaped: nothing they type becomes HTML. */
export function emailHtml(p: { message: string; url: string; creatorName: string; recipientName: string }) {
  const paragraphs = esc(p.message)
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 16px;line-height:1.6">${para.replace(/\n/g, '<br>')}</p>`)
    .join('')
  return `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#2b1d2e;background:#fff8f1;border-radius:20px">
<p style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#b0567a;margin:0 0 20px">A surprise for ${esc(p.recipientName)}</p>
${paragraphs}
<p style="margin:28px 0"><a href="${esc(p.url)}" style="background:#e2557a;color:#fff;text-decoration:none;padding:14px 26px;border-radius:999px;font-family:Arial,sans-serif;font-weight:bold;display:inline-block">Open your surprise ✨</a></p>
<p style="font-size:13px;color:#7a6a74;margin:0">With love, ${esc(p.creatorName)} · made with SurpriseMe</p></div>`
}

