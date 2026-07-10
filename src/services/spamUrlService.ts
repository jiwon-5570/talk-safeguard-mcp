import { loadTextData } from "../utils/dataLoader.js";
import { tryNormalizeUrl } from "../utils/normalizeUrl.js";

const officialSpamUrls = parseOfficialSpamUrlCsv(loadTextData("official-spam-urls.csv"));

function parseOfficialSpamUrlCsv(csv: string): string[] {
  const lines = csv.replace(/^\uFEFF/u, "").split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  return [...new Set(lines.slice(1)
    .map((line) => line.split(",").at(-1)?.trim() ?? "")
    .filter((value) => value.length > 0))];
}

function comparableUrl(value: string): string {
  const normalized = tryNormalizeUrl(value);
  return (normalized.valid ? normalized.normalizedUrl : value).toLowerCase();
}

export function getSpamUrlDataSource(): string {
  return "official-spam-url-dataset";
}

export function matchSpamUrlPatterns(normalizedUrl: string): string[] {
  const lower = comparableUrl(normalizedUrl);
  return officialSpamUrls
    .filter((url) => lower === comparableUrl(url))
    .map((url) => `공식 통신 빅데이터 플랫폼 불법 스팸 URL 데이터셋과 일치합니다: ${url}`);
}
