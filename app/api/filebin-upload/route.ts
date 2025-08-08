import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Best-effort integration with Filebin (https://filebin.net/api)
// Workflow:
// 1) Accept multipart/form-data with field `file`
// 2) Create a bin if one isn't provided (we try /api/bins then /api/bin)
// 3) Upload the file to the bin (we try /api/bins/{bin}/files then fallback to posting to /{bin})
// 4) Return https://filebin.net/{bin}/{filename}

async function createBin(): Promise<string> {
  // Try modern endpoint first
  try {
    const res = await fetch('https://filebin.net/api/bins', {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      type CreateBinResponse = { id?: string; bin?: string; name?: string; binId?: string } | null
      const json: CreateBinResponse = await res.json().catch(() => null)
      const binId = json?.id || json?.bin || json?.name || json?.binId
      if (binId && typeof binId === 'string') return binId
    }
  } catch (_) {
    // ignore and try fallback
  }

  // Fallback older endpoint
  try {
    const res = await fetch('https://filebin.net/api/bin', {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      type CreateBinResponse = { id?: string; bin?: string; name?: string; binId?: string } | null
      const json: CreateBinResponse = await res.json().catch(() => null)
      const binId = json?.id || json?.bin || json?.name || json?.binId
      if (binId && typeof binId === 'string') return binId
    }
  } catch (_) {
    // ignore; we'll generate a random bin id and rely on upload creating it implicitly
  }

  // Last resort: generate a long random id and attempt upload directly
  const random = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => (b % 36).toString(36))
    .join('')
  return random
}

async function tryApiUpload(binId: string, file: File): Promise<{ ok: boolean; lastStatus?: number; lastBody?: string }> {
  const endpoints = [
    `https://filebin.net/api/bins/${encodeURIComponent(binId)}/files`,
    `https://filebin.net/api/bins/${encodeURIComponent(binId)}/file`,
    `https://filebin.net/api/bin/${encodeURIComponent(binId)}/files`,
    `https://filebin.net/api/bin/${encodeURIComponent(binId)}/file`,
  ]
  const fieldNames = ['file', 'file[]', 'files', 'files[]']
  let lastStatus: number | undefined
  let lastBody: string | undefined
  for (const url of endpoints) {
    for (const field of fieldNames) {
      try {
        const fd = new FormData()
        fd.append(field, file, (file as File).name)
        const res = await fetch(url, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: fd,
        })
        lastStatus = res.status
        if (res.status >= 200 && res.status < 300) {
          return { ok: true }
        }
        // capture body text to aid diagnostics
        const txt = await res.text().catch(() => undefined)
        lastBody = typeof txt === 'string' ? txt : undefined
      } catch {
        // continue
      }
    }
  }
  return { ok: false, lastStatus, lastBody }
}

async function tryWebUpload(binId: string, file: File): Promise<{ ok: boolean; lastStatus?: number; lastBody?: string }> {
  try {
    const url = `https://filebin.net/${encodeURIComponent(binId)}`

    const attempt = async (fieldName: string): Promise<boolean> => {
      const fd = new FormData()
      // Preserve filename and type when possible
      fd.append(fieldName, file, (file as File).name)
      const res = await fetch(url, { method: 'POST', body: fd })
      return res.status >= 200 && res.status < 300
    }

    // Try common field names
    if (await attempt('file')) return { ok: true }
    if (await attempt('file[]')) return { ok: true }
    if (await attempt('files')) return { ok: true }
    if (await attempt('files[]')) return { ok: true }
    return { ok: false }
  } catch {
    return { ok: false }
  }
}

async function tryPutUpload(binId: string, file: File): Promise<{ ok: boolean; status?: number; body?: string }> {
  try {
    const fileName = (file as File).name || 'file'
    const url = `https://filebin.net/${encodeURIComponent(binId)}/${encodeURIComponent(fileName)}`
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': (file as File).type || 'application/octet-stream' },
      body: Buffer.from(await file.arrayBuffer()),
    })
    const body = await res.text().catch(() => undefined)
    return { ok: res.status >= 200 && res.status < 300, status: res.status, body }
  } catch {
    return { ok: false }
  }
}

function ensureBinIdStrength(binId: string | null): string {
  const strong = (input: string) => /^[a-z0-9]{12,}$/i.test(input)
  if (binId && strong(binId)) return binId
  // generate 24+ length base36 string
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const generated = Array.from(bytes)
    .map((b) => (b % 36).toString(36))
    .join('')
  return generated
}

async function resolveUploadedFileUrl(binId: string, fallbackFilename: string): Promise<string | null> {
  // Try to list files in bin to confirm the exact stored filename
  try {
    const res = await fetch(`https://filebin.net/api/bins/${encodeURIComponent(binId)}`)
    if (res.ok) {
      const json: any = await res.json().catch(() => null)
      const files: any[] = json?.files || json?.data || []
      if (Array.isArray(files) && files.length > 0) {
        // Prefer exact name match, otherwise pick the latest by created timestamp if present
        const exact = files.find((f: any) => (f?.filename || f?.name) === fallbackFilename)
        const picked = exact || files.sort((a: any, b: any) => {
          const ta = new Date(a?.created || a?.created_at || 0).getTime()
          const tb = new Date(b?.created || b?.created_at || 0).getTime()
          return tb - ta
        })[0]
        const name = picked?.filename || picked?.name
        if (typeof name === 'string' && name) {
          return `https://filebin.net/${encodeURIComponent(binId)}/${encodeURIComponent(name)}`
        }
      }
    }
  } catch (_) {
    // ignore and fallback
  }
  return null
}

async function resolveRedirectedUrl(initialUrl: string): Promise<string> {
  // Try HEAD first to avoid downloading content
  try {
    const headResp = await fetch(initialUrl, { method: 'HEAD', redirect: 'follow' as RequestRedirect })
    if (headResp.ok || (headResp.status >= 300 && headResp.status < 400)) {
      const finalUrl = (headResp as unknown as { url?: string }).url
      if (finalUrl && typeof finalUrl === 'string') return finalUrl
    }
  } catch {
    // ignore and try GET range
  }
  // Fallback to a minimal GET with range to force redirect resolution
  try {
    const getResp = await fetch(initialUrl, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      redirect: 'follow' as RequestRedirect,
    })
    if (getResp.ok || (getResp.status >= 300 && getResp.status < 400)) {
      const finalUrl = (getResp as unknown as { url?: string }).url
      if (finalUrl && typeof finalUrl === 'string') return finalUrl
    }
  } catch {
    // ignore
  }
  return initialUrl
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    const providedBin = (form.get('bin') as string | null)?.trim() || null

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    const filename = (file as File).name || 'file'
    let binId = ensureBinIdStrength(providedBin || (await createBin()))

    // Prefer web upload (implicit bin creation), then PUT, then API upload
    const webAttempt = await tryWebUpload(binId, file)
    const putAttempt = webAttempt.ok ? null : await tryPutUpload(binId, file)
    const apiAttempt = webAttempt.ok || (putAttempt && putAttempt.ok) ? { ok: true } : await tryApiUpload(binId, file)
    if (!(webAttempt.ok || (putAttempt && putAttempt.ok) || apiAttempt.ok)) {
      return NextResponse.json(
        {
          error: 'Failed to upload to Filebin',
          details: {
            bin: binId,
            api: { status: apiAttempt.lastStatus, body: apiAttempt.lastBody?.slice(0, 500) },
            web: webAttempt ? { status: webAttempt.lastStatus, body: webAttempt.lastBody?.slice(0, 500) } : null,
            put: putAttempt ? { status: putAttempt.status, body: putAttempt.body?.slice(0, 500) } : null,
          },
        },
        { status: 502 }
      )
    }

    const resolvedUrl = await resolveUploadedFileUrl(binId, filename)
    const publicUrl = resolvedUrl || `https://filebin.net/${encodeURIComponent(binId)}/${encodeURIComponent(filename)}`
    const finalUrl = await resolveRedirectedUrl(publicUrl)
    return NextResponse.json({ url: finalUrl, bin: binId, filename, originalUrl: publicUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

