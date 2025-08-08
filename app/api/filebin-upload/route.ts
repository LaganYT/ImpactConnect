import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

export const runtime = 'nodejs'

function generateStrongBinId(): string {
  const bytes = randomBytes(24)
  return Array.from(bytes)
    .map((b) => (b % 36).toString(36))
    .join('')
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    const binId = generateStrongBinId()
    const filename = file.name || 'file'
    const targetUrl = `https://filebin.net/${encodeURIComponent(binId)}/${encodeURIComponent(filename)}`

    // Primary: POST per Filebin OpenAPI
    const postResp = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: Buffer.from(await file.arrayBuffer()),
    })

    if (postResp.status >= 200 && postResp.status < 300) {
      return NextResponse.json({
        url: `https://filebin.net/${encodeURIComponent(binId)}/${encodeURIComponent(filename)}`,
        bin: binId,
        status: postResp.status,
      })
    }

    // Fallback: try PUT
    const putResp = await fetch(targetUrl, {
      method: 'PUT',
      headers: { 'Content-Type': (file as any).type || 'application/octet-stream' },
      body: Buffer.from(await file.arrayBuffer()),
    })

    if (putResp.status >= 200 && putResp.status < 300) {
      return NextResponse.json({
        url: `https://filebin.net/${encodeURIComponent(binId)}/${encodeURIComponent(filename)}`,
        bin: binId,
        status: putResp.status,
      })
    }

    const postBody = await postResp.text().catch(() => '')
    const putBody = await putResp.text().catch(() => '')
    return NextResponse.json(
      {
        error: 'Filebin upload failed',
        detail: {
          post: { status: postResp.status, body: postBody?.slice(0, 2000) },
          put: { status: putResp.status, body: putBody?.slice(0, 2000) },
        },
      },
      { status: 502 },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

