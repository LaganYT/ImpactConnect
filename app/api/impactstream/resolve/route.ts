import { NextResponse } from "next/server";

function isValidImpactStreamUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      ["impactstream.vercel.app", "www.impactstream.vercel.app"].includes(
        u.hostname,
      ) && (/^\/tv\//.test(u.pathname) || /^\/movie\//.test(u.pathname))
    );
  } catch {
    return false;
  }
}

function extractVidsrcUrl(html: string): string | null {
  if (!html) return null;

  // Collect potential candidates containing "vidsrc"
  const candidates = new Set<string>();

  // Generic absolute URLs with vidsrc in them
  const absUrlRegex = /https?:\/\/[^\s"'<>]*vidsrc[^\s"'<>]*/gi;
  let m: RegExpExecArray | null;
  while ((m = absUrlRegex.exec(html)) !== null) {
    candidates.add(m[0]);
  }

  // src attributes that include vidsrc
  const srcAttrRegex = /src=["']([^"']*vidsrc[^"']*)["']/gi;
  while ((m = srcAttrRegex.exec(html)) !== null) {
    const val = m[1];
    if (/^https?:/i.test(val)) candidates.add(val);
  }

  // JSON-like structures: "url":"...vidsrc..."
  const jsonUrlRegex = /\burl\b\s*:\s*"([^"]*vidsrc[^"]*)"/gi;
  while ((m = jsonUrlRegex.exec(html)) !== null) {
    const val = m[1];
    if (/^https?:/i.test(val)) candidates.add(val);
  }

  if (candidates.size === 0) return null;

  // Prefer embeds
  const prioritized = Array.from(candidates).sort((a, b) => {
    const aScore = (/(?:\/embed|\?tmdb=|\?imdb=)/i.test(a) ? 1 : 0) +
      (/vidsrc\.(?:to|xyz|cc|me|su|io)/i.test(a) ? 1 : 0);
    const bScore = (/(?:\/embed|\?tmdb=|\?imdb=)/i.test(b) ? 1 : 0) +
      (/vidsrc\.(?:to|xyz|cc|me|su|io)/i.test(b) ? 1 : 0);
    return bScore - aScore;
  });

  return prioritized[0] || null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pageUrl = searchParams.get("url");
    if (!pageUrl || !isValidImpactStreamUrl(pageUrl)) {
      return NextResponse.json(
        { ok: false, error: "Invalid ImpactStream URL" },
        { status: 400 },
      );
    }

    const res = await fetch(pageUrl, {
      // Avoid caching too long; content rarely changes
      // Next: mark as dynamic to prevent stale results during dev
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Upstream responded ${res.status}` },
        { status: 502 },
      );
    }

    const html = await res.text();
    const embedUrl = extractVidsrcUrl(html);
    if (!embedUrl) {
      return NextResponse.json(
        { ok: false, error: "No vidsrc URL found" },
        { status: 404 },
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


