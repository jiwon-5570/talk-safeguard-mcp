const TRAILING_PUNCTUATION = /[),.;!?}>'"]+$/u;

export function normalizeUrl(rawUrl: string): string {
  let value = rawUrl.trim().replace(TRAILING_PUNCTUATION, "");
  value = value.replace(/^hxxps:/i, "https:").replace(/^hxxp:/i, "http:");
  if (/^www\./i.test(value)) {
    value = `https://${value}`;
  }
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  const parsed = new URL(value);
  parsed.hostname = parsed.hostname.toLowerCase().replace(/\.$/u, "");
  parsed.hash = "";
  if ((parsed.protocol === "http:" && parsed.port === "80") || (parsed.protocol === "https:" && parsed.port === "443")) {
    parsed.port = "";
  }
  return parsed.toString();
}

export function tryNormalizeUrl(rawUrl: string): { normalizedUrl: string; valid: boolean } {
  try {
    return { normalizedUrl: normalizeUrl(rawUrl), valid: true };
  } catch {
    return { normalizedUrl: rawUrl.trim(), valid: false };
  }
}
