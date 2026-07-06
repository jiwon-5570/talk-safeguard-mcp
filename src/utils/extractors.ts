import { loadJsonData } from "./dataLoader.js";
import { tryNormalizeUrl } from "./normalizeUrl.js";

interface ScamKeywords {
  urgent: string[];
  money: string[];
  family: string[];
  agency: string[];
  phoneAvoidance: string[];
  delivery: string[];
  loan: string[];
  shopping: string[];
  usedMarket: string[];
  authCode: string[];
  remoteApp: string[];
  sensitive: string[];
}

export interface RiskIndicators {
  urls: string[];
  phoneNumbers: string[];
  bankAccountCandidates: string[];
  businessRegistrationNumbers: string[];
  organizationNames: string[];
  moneyAmounts: string[];
  urgentPhrases: string[];
  sensitiveInfoRequests: string[];
  suspiciousKeywords: string[];
}

export const scamKeywords = loadJsonData<ScamKeywords>("scam-keywords.json");

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function includedKeywords(message: string, keywords: string[]): string[] {
  const lower = message.toLocaleLowerCase("ko-KR");
  return keywords.filter((keyword) => lower.includes(keyword.toLocaleLowerCase("ko-KR")));
}

export function extractUrls(message: string): string[] {
  const matches = message.match(/(?:https?|hxxps?):\/\/[^\s<>"']+|www\.[^\s<>"']+/giu) ?? [];
  return unique(
    matches.map((match) => {
      const normalized = tryNormalizeUrl(match);
      return normalized.valid ? normalized.normalizedUrl : match;
    }),
  );
}

export function extractRiskIndicators(message: string): RiskIndicators {
  const businessMatches = message.match(/(?<!\d)\d{3}-?\d{2}-?\d{5}(?!\d)/gu) ?? [];
  const businessRegistrationNumbers = unique(businessMatches.map((value) => value.replace(/\D/gu, "")));

  const phoneMatches = message.match(/(?<!\d)(?:\+?82[-\s]?)?0?1[016789][-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)|(?<!\d)0(?:2|[3-6][1-5])[-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/gu) ?? [];
  const phoneNumbers = unique(phoneMatches.map((value) => value.trim()));
  const phoneDigits = new Set(phoneNumbers.map((value) => value.replace(/\D/gu, "")));
  const businessDigits = new Set(businessRegistrationNumbers);

  const numericCandidates = message.match(/(?<!\d)(?:\d[-\s]?){10,16}(?!\d)/gu) ?? [];
  const bankAccountCandidates = unique(
    numericCandidates
      .map((value) => value.trim())
      .filter((value) => {
        const digits = value.replace(/\D/gu, "");
        return !phoneDigits.has(digits) && !businessDigits.has(digits) && digits.length >= 10 && digits.length <= 16;
      }),
  );

  const moneyAmounts = unique(
    message.match(/(?<!\d)\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:원|만원|억(?:\s*원)?)(?!\w)/gu) ?? [],
  );
  const urgentPhrases = includedKeywords(message, scamKeywords.urgent);
  const sensitiveInfoRequests = includedKeywords(message, scamKeywords.sensitive);
  const organizationNames = unique(
    includedKeywords(message, scamKeywords.agency).concat(
      message.match(/[가-힣A-Za-z0-9]+(?:은행|증권|거래소|택배|검찰|경찰서|지검)/gu) ?? [],
    ),
  );
  const suspiciousKeywords = unique(
    [
      ...scamKeywords.money,
      ...scamKeywords.family,
      ...scamKeywords.agency,
      ...scamKeywords.phoneAvoidance,
      ...scamKeywords.delivery,
      ...scamKeywords.loan,
      ...scamKeywords.shopping,
      ...scamKeywords.usedMarket,
      ...scamKeywords.authCode,
      ...scamKeywords.remoteApp,
    ].filter((keyword) => message.toLocaleLowerCase("ko-KR").includes(keyword.toLocaleLowerCase("ko-KR"))),
  );

  return {
    urls: extractUrls(message),
    phoneNumbers,
    bankAccountCandidates,
    businessRegistrationNumbers,
    organizationNames,
    moneyAmounts,
    urgentPhrases,
    sensitiveInfoRequests,
    suspiciousKeywords,
  };
}
