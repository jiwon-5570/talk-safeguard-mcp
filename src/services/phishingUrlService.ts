import type { CanProceed, RiskLevel } from "../mcp/schemas.js";
import { tryNormalizeUrl } from "../utils/normalizeUrl.js";
import { clampRiskScore, scoreToRiskLevel } from "../utils/scoring.js";
import { getSpamUrlDataSource, matchSpamUrlPatterns } from "./spamUrlService.js";

export interface PhishingUrlAnalysis {
  normalizedUrl: string;
  domain: string;
  riskScore: number;
  riskLevel: RiskLevel;
  matchedKnownPattern: boolean;
  matchedDataSource: string;
  suspiciousSignals: string[];
  canOpen: CanProceed;
  urlDecision: string;
  domainSummary: string;
  officialCheckGuide: string[];
  safeAction: string;
  networkFetchPolicy: string;
}

const shorteners = new Set(["bit.ly", "tinyurl.com", "t.co", "url.kr", "han.gl", "vo.la", "me2.do", "me2.kr"]);
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

export function analyzePhishingUrl(rawUrl: string): PhishingUrlAnalysis {
  const normalized = tryNormalizeUrl(rawUrl);
  if (!normalized.valid) {
    return {
      normalizedUrl: normalized.normalizedUrl,
      domain: "",
      riskScore: 80,
      riskLevel: "HIGH",
      matchedKnownPattern: false,
      matchedDataSource: "heuristic",
      suspiciousSignals: ["URL 형식을 정상적으로 해석할 수 없습니다."],
      canOpen: "NO",
      urlDecision: "URL 형식을 확인할 수 없어 열지 않는 것이 안전합니다.",
      domainSummary: "도메인을 정상적으로 추출하지 못했습니다.",
      officialCheckGuide: ["메시지의 링크 대신 해당 기관의 공식 앱이나 직접 입력한 공식 홈페이지를 이용하세요."],
      safeAction: "링크를 열지 말고 발신자가 주장하는 기관의 공식 앱이나 대표번호에서 직접 확인하세요.",
      networkFetchPolicy: "사용자 보호와 서버 보안을 위해 입력 URL에 직접 접속하지 않습니다.",
    };
  }

  const parsed = new URL(normalized.normalizedUrl);
  const hostname = parsed.hostname.toLowerCase();
  const isOfficialDomain = Object.values(officialDomains)
    .flat()
    .some((allowed) => isDomainOrSubdomain(hostname, allowed));
  const weightedSignals = new Map<string, number>();
  const addSignal = (signal: string, weight: number): void => {
    weightedSignals.set(signal, Math.max(weightedSignals.get(signal) ?? 0, weight));
  };
  const spamSignals = matchSpamUrlPatterns(normalized.normalizedUrl);
  for (const signal of spamSignals) addSignal(signal, 60);

  if (/^hxxps?:/iu.test(rawUrl.trim())) addSignal("hxxp 형태로 주소를 변형해 필터 우회를 시도할 수 있습니다.", 20);
  if (shorteners.has(hostname)) addSignal("목적지를 숨길 수 있는 단축 URL입니다.", 25);
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/u.test(hostname)) addSignal("도메인 대신 IP 주소를 사용합니다.", 45);
  if (hostname.includes("xn--")) addSignal("국제화 도메인 표기가 포함되어 문자 위장 가능성을 확인해야 합니다.", 35);
  if ((hostname.match(/-/gu) ?? []).length >= 3) addSignal("도메인에 하이픈이 과도하게 포함되어 있습니다.", 15);
  if (hostname.split(".").length >= 5) addSignal("서브도메인이 과도하게 중첩되어 있습니다.", 15);
  if ((hostname.match(/\d/gu) ?? []).length >= 5) addSignal("도메인에 숫자가 과도하게 포함되어 있습니다.", 15);
  if (parsed.protocol === "http:") addSignal("암호화되지 않은 HTTP 링크입니다.", 10);
  if (!isOfficialDomain && /login|verify|cert|auth|gift|event|pay|delivery/iu.test(parsed.pathname + parsed.search)) {
    addSignal("URL 경로에 로그인·인증·결제·이벤트 유도 표현이 포함되어 있습니다.", 15);
  }
  if (!isOfficialDomain && /kakao-?pay-?(?:event|cert)|naver-?login-?check|gov24-?check|obituary-?check|wedding-?(?:invite|check)/iu.test(hostname)) {
    addSignal("브랜드·생활 안내와 인증 또는 이벤트를 결합한 의심 도메인 패턴입니다.", 25);
  }

  for (const [brand, allowlist] of Object.entries(officialDomains)) {
    if (hostname.includes(brand) && !allowlist.some((allowed) => isDomainOrSubdomain(hostname, allowed))) {
      addSignal(`${brand} 공식 도메인과 유사하지만 공식 허용 도메인과 일치하지 않습니다.`, 35);
    }
  }

  const suspiciousSignals = [...weightedSignals.keys()];
  const riskScore = clampRiskScore([...weightedSignals.values()].reduce((sum, weight) => sum + weight, 0));
  const riskLevel = scoreToRiskLevel(riskScore);
  const matchedKnownPattern = spamSignals.length > 0;
  const matchedDataSource = spamSignals.length > 0 ? getSpamUrlDataSource() : "heuristic";
  const canOpen: CanProceed = riskLevel === "HIGH" || riskLevel === "CRITICAL"
    ? "NO"
    : riskLevel === "LOW" && isOfficialDomain
      ? "YES"
      : "CHECK_FIRST";
  const urlDecision = canOpen === "NO"
    ? `공식 도메인으로 확인되지 않거나 복합 위험 신호가 있어 ${hostname} 링크를 누르지 않는 것이 안전합니다.`
    : canOpen === "YES"
      ? "등록된 공식 허용 도메인과 일치하고 현재 규칙에서 뚜렷한 위험 신호가 적습니다. 그래도 링크 자체의 안전을 보장하지는 않습니다."
      : "현재 정보만으로 링크의 안전을 확인할 수 없습니다. 공식 앱이나 직접 입력한 공식 주소에서 먼저 확인하세요.";
  const officialCheckGuide = [
    "메시지 속 링크 대신 해당 서비스의 공식 앱이나 직접 입력한 공식 홈페이지에서 같은 안내가 있는지 확인하세요.",
    "주소창의 실제 도메인이 공식 도메인과 철자까지 정확히 일치하는지 확인하세요.",
    ...(hostname.includes("kakao")
      ? ["카카오톡 또는 카카오페이 공식 앱에서 이벤트·계정 알림을 직접 확인하세요."]
      : []),
  ];

  const base = {
    normalizedUrl: normalized.normalizedUrl,
    domain: hostname,
    riskScore,
    riskLevel,
    matchedKnownPattern,
    matchedDataSource,
    suspiciousSignals,
    canOpen,
    urlDecision,
    domainSummary: isOfficialDomain
      ? `${hostname}은 현재 등록된 공식 허용 도메인 범위와 일치합니다.`
      : `${hostname}은 공식 허용 도메인으로 확인되지 않았으며 별도 검증이 필요합니다.`,
    officialCheckGuide,
    safeAction:
      riskLevel === "LOW"
        ? "링크만으로 안전을 보장할 수 없으므로 공식 앱이나 직접 입력한 공식 주소에서 한 번 더 확인하세요."
        : "링크를 열지 말고 발신자가 주장하는 기관의 공식 앱이나 대표번호에서 직접 확인하세요.",
    networkFetchPolicy: "사용자 보호와 서버 보안을 위해 입력 URL에 직접 접속하지 않고 정규화·공식 데이터·도메인 규칙으로만 점검합니다.",
  };
  return base;
}
