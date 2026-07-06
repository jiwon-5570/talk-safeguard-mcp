import type { RiskLevel } from "../mcp/schemas.js";
import { loadJsonData } from "../utils/dataLoader.js";

export interface InvestmentRiskAnalysis {
  riskLevel: RiskLevel;
  suspiciousSignals: string[];
  policyBasedWarnings: string[];
  recommendedActions: string[];
}

const keywords = loadJsonData<string[]>("investment-risk-keywords.json");

export function analyzeInvestmentRoomRisk(message: string): InvestmentRiskAnalysis {
  const suspiciousSignals = keywords.filter((keyword) => message.toLocaleLowerCase("ko-KR").includes(keyword.toLocaleLowerCase("ko-KR")));
  const hasGuarantee = suspiciousSignals.some((keyword) => ["원금 보장", "수익 보장", "손실 없음", "매일 수익"].includes(keyword)) || /매일\s*\d+(?:\.\d+)?%/u.test(message);
  const hasExternalDeposit = /해외거래소|개인계좌|입금 인증|계좌 대여/u.test(message);
  const hasRoomPromotion = /리딩방|무료 종목 추천|급등주|내부정보/u.test(message);

  let riskLevel: RiskLevel = "LOW";
  if (hasGuarantee && hasExternalDeposit && hasRoomPromotion) riskLevel = "CRITICAL";
  else if (suspiciousSignals.length >= 3 || (hasGuarantee && hasExternalDeposit)) riskLevel = "HIGH";
  else if (suspiciousSignals.length >= 1 || /리딩방/u.test(message)) riskLevel = "MEDIUM";

  return {
    riskLevel,
    suspiciousSignals: [...suspiciousSignals, ...(/매일\s*\d+(?:\.\d+)?%/u.test(message) ? ["구체적인 일일 고수익 약속"] : [])],
    policyBasedWarnings: [
      ...(hasGuarantee ? ["투자에서 원금·수익을 보장하거나 손실이 없다고 단정하는 홍보는 중대한 위험 신호입니다."] : []),
      ...(hasExternalDeposit ? ["외부 거래소 가입이나 개인계좌 입금 유도는 자금 회수 위험을 높일 수 있습니다."] : []),
      "리딩방 운영자 주장과 수익 화면만으로 인가·등록 여부나 실제 수익을 확인할 수 없습니다.",
    ],
    recommendedActions: [
      "추가 입금과 거래소 가입을 중단하세요.",
      "금융감독원 파인 등 공식 경로에서 업체의 제도권 금융회사 여부를 확인하세요.",
      "이미 송금했다면 즉시 은행 고객센터, 경찰 112, 금융감독원 1332에 문의하세요.",
    ],
  };
}
