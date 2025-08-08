import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    const apiKey = process.env.IMGBB_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'IMGBB_KEY is not configured on the server' }, { status: 500 })
    }

    const arrayBuffer = await file.arrayBuffer()
    // Convert ArrayBuffer to base64 without Buffer to be environment-safe
    const uint8Array = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i])
    }
    const base64 = btoa(binary)

    const body = new URLSearchParams()
    body.append('image', base64)

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const json = await res.json().catch(() => null)
    if (!res.ok || !json) {
      return NextResponse.json({ error: 'Failed to upload to imgbb' }, { status: 502 })
    }

    const url = json?.data?.display_url || json?.data?.url || json?.data?.image?.url
    if (!url) {
      const message = json?.error?.message || 'imgbb did not return a URL'
      return NextResponse.json({ error: message }, { status: 502 })
    }

    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

