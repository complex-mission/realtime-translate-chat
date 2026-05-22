'use client'

export async function collectFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return 'server'

  const components = [
    navigator.userAgent,
    screen.width + 'x' + screen.height,
    screen.colorDepth.toString(),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    navigator.hardwareConcurrency?.toString() || '',
    (navigator as any).deviceMemory?.toString() || '',
  ]

  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 200; canvas.height = 50
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillStyle = '#f60'
      ctx.fillRect(125, 1, 62, 20)
      ctx.fillStyle = '#069'
      ctx.fillText('fingerprint', 2, 15)
      components.push(canvas.toDataURL().slice(-50))
    }
  } catch {}

  // WebGL fingerprint
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl')
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (ext) {
        components.push(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL))
        components.push(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      }
    }
  } catch {}

  // Simple hash
  const str = components.join('|')
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}
