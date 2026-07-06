import { loadJsonData } from "../utils/dataLoader.js";

interface SpamPattern {
  pattern: string;
  description: string;
}

const samplePatterns = loadJsonData<SpamPattern[]>("sample-spam-url-patterns.json");

export function matchSpamUrlPatterns(normalizedUrl: string): string[] {
  const lower = normalizedUrl.toLowerCase();
  return samplePatterns
    .filter(({ pattern }) => lower.includes(pattern.toLowerCase()))
    .map(({ description }) => description);
}
