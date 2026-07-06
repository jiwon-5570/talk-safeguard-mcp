import type { RiskLevel } from "../mcp/schemas.js";
import { loadJsonData } from "../utils/dataLoader.js";
import { tryNormalizeUrl } from "../utils/normalizeUrl.js";
import { matchSpamUrlPatterns } from "./spamUrlService.js";

interface PhishingSample {
  url: string;
  source: string;
  category: string;
}

export interface PhishingUrlAnalysis {
  normalizedUrl: string;
  riskLevel: RiskLevel;
  matchedKnownPattern: boolean;
  matchedDataSource?: string;
  suspiciousSignals: string[];
  safeAction: string;
}

const samples = loadJsonData<PhishingSample[]>("sample-phishing-urls.json");
const shorteners = new Set(["bit.ly", "tinyurl.com", "t.co", "url.kr", "han.gl", "vo.la", "me2.do"]);
const officialDomains: Record<string, string[]> = {
  kakao: ["kakao.com", "kakao.co.kr", "kakaocorp.com"],
  naver: ["naver.com", "naver.net"],
  coupang: ["coupang.com"],
  cj: ["cj.net", "cjlogistics.com"],
  police: ["police.go.kr"],
  fss: ["fss.or.kr"],
};

function isDomainOrSubdomain(hostname: string, allowed: string): boolean {
  return hostname === allowed || hostname.endsWith(`.${allowed}`);
}

function knownSampleMatch(normalizedUrl: string): PhishingSample | undefined {
  const target = new URL(normalizedUrl);
  return samples.find((sample) => {
    const normalizedSample = tryNormalizeUrl(sample.url);
    if (!normalizedSample.valid) return false;
    const candidate = new URL(normalizedSample.normalizedUrl);
    return target.hostname === candidate.hostname && target.pathname.startsWith(candidate.pathname);
  });
}

export function analyzePhishingUrl(rawUrl: string): PhishingUrlAnalysis {
  const normalized = tryNormalizeUrl(rawUrl);
  if (!normalized.valid) {
    return {
      normalizedUrl: normalized.normalizedUrl,
      riskLevel: "HIGH",
      matchedKnownPattern: false,
      suspiciousSignals: ["URL 형식을 정상적으로 해석할 수 없습니다."],
      safeAction: "링크를 열지 말고 발신자가 주장하는 기관의 공식 앱이나 대표번호에서 직접 확인하세요.",
    };
  }

  const parsed = new URL(normalized.normalizedUrl);
  const hostname = parsed.hostname.toLowerCase();
  const signals: string[] = [];
  const matchedSample = knownSampleMatch(normalized.normalizedUrl);
  const spamSignals = matchSpamUrlPatterns(normalized.normalizedUrl);
  signals.push(...spamSignals);

  if (shorteners.has(hostname)) signals.push("목적지를 숨길 수 있는 단축 URL입니다.");
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/u.test(hostname)) signals.push("도메인 대신 IP 주소를 사용합니다.");
  if (hostname.includes("xn--")) signals.push("국제화 도메인 표기가 포함되어 문자 위장 가능성을 확인해야 합니다.");
  if ((hostname.match(/-/gu) ?? []).length >= 3) signals.push("도메인에 하이픈이 과도하게 포함되어 있습니다.");
  if (hostname.split(".").length >= 5) signals.push("서브도메인이 과도하게 중첩되어 있습니다.");
  if ((hostname.match(/\d/gu) ?? []).length >= 5) signals.push("도메인에 숫자가 과도하게 포함되어 있습니다.");
  if (parsed.protocol === "http:") signals.push("암호화되지 않은 HTTP 링크입니다.");

  for (const [brand, allowlist] of Object.entries(officialDomains)) {
    if (hostname.includes(brand) && !allowlist.some((allowed) => isDomainOrSubdomain(hostname, allowed))) {
      signals.push(`${brand} 공식 도메인과 유사하지만 공식 허용 도메인과 일치하지 않습니다.`);
    }
  }

  if (matchedSample) signals.unshift("로컬 피싱 URL 데모 데이터와 일치합니다.");
  const suspiciousSignals = [...new Set(signals)];
  let riskLevel: RiskLevel = "LOW";
  if (matchedSample) riskLevel = "CRITICAL";
  else if (suspiciousSignals.length >= 3) riskLevel = "HIGH";
  else if (suspiciousSignals.length >= 1) riskLevel = "MEDIUM";

  const base = {
    normalizedUrl: normalized.normalizedUrl,
    riskLevel,
    matchedKnownPattern: matchedSample !== undefined,
    suspiciousSignals,
    safeAction:
      riskLevel === "LOW"
        ? "링크만으로 안전을 보장할 수 없으므로 공식 앱이나 직접 입력한 공식 주소에서 한 번 더 확인하세요."
        : "링크를 열지 말고 발신자가 주장하는 기관의 공식 앱이나 대표번호에서 직접 확인하세요.",
  };
  return matchedSample ? { ...base, matchedDataSource: matchedSample.source } : base;
}
