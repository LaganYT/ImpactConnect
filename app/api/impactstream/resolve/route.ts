import { NextResponse } from "next/server";

function parseImpactStreamUrl(raw: string): { type: "movie" | "tv"; id: string } | null {
  try {
    const u = new URL(raw);
    if (![
      "impactstream.vercel.app",
      "www.impactstream.vercel.app",
    ].includes(u.hostname))
      return null;
    const m = u.pathname.match(/^\/(movie|tv)\/(\d+)/i);
    if (!m) return null;
    const type = m[1].toLowerCase() as "movie" | "tv";
    const id = m[2];
    return { type, id };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pageUrl = searchParams.get("url");
    const parsed = pageUrl ? parseImpactStreamUrl(pageUrl) : null;
    if (!parsed) {
      return NextResponse.json(
        { ok: false, error: "Invalid ImpactStream URL" },
        { status: 400 },
      );
    }

    const apiUrl = `https://impactstream.vercel.app/api/vidsrc?type=${encodeURIComponent(
      parsed.type,
    )}&id=${encodeURIComponent(parsed.id)}`;
    const res = await fetch(apiUrl, {
      headers: {
        Accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Upstream responded ${res.status}` },
        { status: 502 },
      );
    }

    const bodyText = await res.text();
    let embedUrl: string | null = null;
    try {
      const json = JSON.parse(bodyText) as Record<string, unknown> | null;
      const v = json && (json["embedUrl"] || json["url"] || json["vidsrc"]);
      embedUrl = typeof v === "string" ? v : null;
    } catch {
      // not JSON; maybe raw URL as text
      const trimmed = bodyText.trim();
      if (/^https?:\/\//i.test(trimmed)) embedUrl = trimmed;
    }

    if (!embedUrl) {
      return NextResponse.json(
        { ok: false, error: "No vidsrc URL in response" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, embedUrl });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Failed to resolve" },
      { status: 500 },
    );
  }
}


