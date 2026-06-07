import { parse } from "node-html-parser";

export async function fetchAdvisoryHtml(
  url: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const resp = await fetchFn(url);
  if (!resp.ok) {
    throw new Error(`NCSC advisory page fetch failed: ${resp.status} ${url}`);
  }
  const html = await resp.text();
  return extractAdvisoryText(html, url);
}

export function extractAdvisoryText(html: string, url: string): string {
  try {
    const root = parse(html);

    for (const el of root.querySelectorAll(
      "script, style, nav, footer, header, .cookie-notice, .breadcrumbs, .site-header, .site-footer",
    )) {
      el.remove();
    }

    const main =
      root.querySelector("main") ??
      root.querySelector("[role='main']") ??
      root.querySelector(".content") ??
      root.querySelector("article") ??
      root;

    const parts: string[] = [];
    for (const el of main.querySelectorAll("h1, h2, h3, p, li")) {
      const text = el.text.trim();
      if (text.length > 0) parts.push(text);
    }

    const result = parts.join("\n");
    if (result.length === 0) {
      // Log so the drop is visible in monitoring — empty text → item dropped (Invariant 1).
      console.warn(
        `[ncsc-html-fetcher] Empty text extracted from advisory at ${url} — item will be dropped`,
      );
    }
    return result;
  } catch (err) {
    console.warn(
      `[ncsc-html-fetcher] HTML extraction error for ${url}: ${String(err)} — item will be dropped`,
    );
    return "";
  }
}
