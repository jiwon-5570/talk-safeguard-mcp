import type {
  CanProceed,
  RiskLevel,
  ScamType,
  UserSituation,
  Verdict,
} from "../mcp/schemas.js";
import type { RiskIndicators } from "../utils/extractors.js";
import { scamTypeLabel } from "./safetyGuideService.js";

export interface FraudDecision {
  decisionSummary: string;
  verdict: Verdict;
  canProceed: CanProceed;
  userQuestionAnswer: string;
  verificationChecklist: string[];
  evidenceSummary: string[];
  nextStepGuide: string[];
  incidentReportSummary: string;
}

interface FraudDecisionInput {
  message: string;
  userQuestion?: string;
  userSituation: UserSituation;
  riskScore: number;
  riskLevel: RiskLevel;
  scamTypes: ScamType[];
  reasons: string[];
  indicators: RiskIndicators;
  immediateActions: string[];
  reportGuide: string[];
  incidentReportSummary: string;
}

const decisiveRiskTypes = new Set<ScamType>([
  "FAMILY_IMPERSONATION",
  "AGENCY_IMPERSONATION",
  "KAKAO_BRAND_IMPERSONATION",
  "DELIVERY_SMISHING",
  "INVITATION_SMISHING",
  "PUBLIC_NOTICE_SMISHING",
  "INVESTMENT_ROOM",
  "GIFT_CARD_SCAM",
  "ACCOUNT_TAKEOVER",
  "AUTH_CODE_REQUEST",
  "REMOTE_APP_INSTALL",
]);

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function determineVerdict(input: FraudDecisionInput): Verdict {
  if (["sent_money", "installed_app", "shared_info"].includes(input.userSituation)) return "URGENT_ACTION";
  if (input.message.trim().length < 8 && input.reasons.length === 0) return "INSUFFICIENT_INFO";
  const decisiveType = input.scamTypes.some((type) => decisiveRiskTypes.has(type));
  if (input.riskLevel === "CRITICAL" || (input.riskLevel === "HIGH" && decisiveType)) {
    return "HIGHLY_SUSPICIOUS";
  }
  if (input.riskLevel === "HIGH" || (input.riskLevel === "MEDIUM" && input.reasons.length >= 2)) {
    return "SUSPICIOUS";
  }
  if (input.riskLevel === "MEDIUM" || input.reasons.length > 0) return "NEEDS_CAUTION";
  return "SAFE_LIKELY";
}

function determineCanProceed(verdict: Verdict): CanProceed {
  if (verdict === "URGENT_ACTION" || verdict === "HIGHLY_SUSPICIOUS" || verdict === "SUSPICIOUS") return "NO";
  if (verdict === "INSUFFICIENT_INFO" || verdict === "NEEDS_CAUTION") return "CHECK_FIRST";
  return "YES";
}

function decisionSummary(input: FraudDecisionInput, verdict: Verdict): string {
  if (verdict === "URGENT_ACTION") {
    return "이미 링크 클릭·송금·앱 설치·정보 제공이 진행된 상황입니다. 추가 행동을 중단하고 공식 대응 절차를 시작해야 합니다.";
  }
  if (verdict === "INSUFFICIENT_INFO") {
    return "판단할 정보가 부족합니다. 메시지의 전체 문구, 링크, 요구 행동을 확인해야 합니다.";
  }
  if (verdict === "SAFE_LIKELY") {
    return "현재 메시지에서 뚜렷한 위험 신호는 거의 확인되지 않았습니다. 다만 이 결과가 메시지의 안전을 보장하지는 않습니다.";
  }
  const primaryType = input.scamTypes.find((type) => type !== "UNKNOWN_RISK") ?? "UNKNOWN_RISK";
  if (verdict === "NEEDS_CAUTION") {
    return `일부 확인이 필요한 위험 신호가 있습니다. ${scamTypeLabel(primaryType)} 여부를 공식 경로에서 확인한 뒤 행동하세요.`;
  }
  return `이 메시지는 ${scamTypeLabel(primaryType)}과 관련된 복합 신호가 있어 사기 위험이 ${verdict === "HIGHLY_SUSPICIOUS" ? "매우 높습니다" : "높습니다"}.`;
}

function buildVerificationChecklist(input: FraudDecisionInput): string[] {
  const checklist = ["메시지에 적힌 연락처나 링크가 아닌 공식 앱·공식 홈페이지에서 내용을 직접 확인하기"];
  const types = new Set(input.scamTypes);

  if (types.has("FAMILY_IMPERSONATION") || types.has("GIFT_CARD_SCAM")) {
    checklist.push("새로 받은 번호나 카톡 프로필만 믿지 말고 기존에 저장된 가족·지인 번호로 직접 전화하기");
  }
  if (input.indicators.urls.length > 0) {
    checklist.push("URL의 실제 도메인이 주장하는 기관의 공식 도메인과 정확히 일치하는지 확인하기");
  }
  if (input.indicators.businessRegistrationNumbers.length > 0 || types.has("SHOPPING_PREPAYMENT") || types.has("USED_MARKET_PREPAYMENT")) {
    checklist.push("국세청 사업자 상태와 공정위 통신판매사업자 등록 정보를 각각 확인하기");
    checklist.push("개인계좌 선입금이나 안전결제 거부 없이 구매자 보호 결제가 가능한지 확인하기");
  }
  if (types.has("INVESTMENT_ROOM")) {
    checklist.push("금융감독원 파인에서 제도권 금융회사 여부를 확인하기");
    checklist.push("원금 보장·확정 수익·해외거래소 입금 약속이 있는지 확인하기");
  }
  if (types.has("ACCOUNT_TAKEOVER") || types.has("AUTH_CODE_REQUEST")) {
    checklist.push("카카오 공식 앱의 계정·보안 화면에서 제한 여부를 직접 확인하기");
  }
  if (types.has("UNKNOWN_RISK") && input.reasons.length === 0) {
    checklist.push("발신자와 대화 맥락이 평소와 일치하는지 별도 연락 수단으로 확인하기");
  }
  return unique(checklist);
}

function answerUserQuestion(input: FraudDecisionInput, canProceed: CanProceed, summary: string): string {
  const question = input.userQuestion?.toLocaleLowerCase("ko-KR") ?? "";
  const types = new Set(input.scamTypes);

  if (input.userSituation === "sent_money") {
    return "추가 송금을 중단하고 즉시 해당 은행 고객센터에 지급정지 가능 여부를 문의하세요. 경찰 112와 금융감독원 1332에도 공식 절차를 확인하세요.";
  }
  if (input.userSituation === "installed_app") {
    return "의심 앱의 네트워크 연결을 끊고 추가 권한을 승인하지 마세요. 다른 안전한 기기로 금융기관과 112에 연락하고 휴대폰 보안 점검을 진행하세요.";
  }
  if (input.userSituation === "shared_info") {
    return "추가 정보 입력을 중단하고 다른 안전한 기기에서 같은 비밀번호를 사용하는 계정의 비밀번호를 변경하세요. 금융정보를 입력했다면 카드사나 은행 고객센터에 문의하세요.";
  }
  if (input.userSituation === "clicked_link") {
    return "이미 링크를 눌렀다면 페이지를 닫고 개인정보 입력과 파일 다운로드를 중단하세요. 설치된 앱·프로필이 없는지 확인하고 공식 앱에서 안내 내용을 다시 확인하세요.";
  }
  if (/사업자|쇼핑몰|판매자|믿어/u.test(question)) {
    const prepaymentRisk = types.has("SHOPPING_PREPAYMENT") || types.has("USED_MARKET_PREPAYMENT");
    return prepaymentRisk
      ? "사업자번호가 있어도 거래 안전이 보장되지는 않습니다. 개인계좌 선입금이나 안전결제 거부가 있으면 결제하지 않는 것이 안전합니다."
      : "사업자번호가 있어도 거래 안전이 보장되지는 않습니다. 사업자 상태와 통신판매업 등록 여부, 안전결제 가능 여부를 모두 확인하세요.";
  }
  if (/링크|url|눌러|클릭|열어/u.test(question)) {
    return canProceed === "NO"
      ? "현재 메시지에는 링크 클릭을 유도하는 위험 신호가 있어 누르지 않는 것이 안전합니다. 공식 앱이나 공식 홈페이지에서 직접 확인하세요."
      : "뚜렷한 위험 신호가 적더라도 링크의 안전을 보장할 수 없습니다. 공식 앱이나 직접 입력한 공식 주소에서 먼저 확인하세요.";
  }
  if (/송금|입금|이체|결제|돈.*보내/u.test(question)) {
    return canProceed === "NO"
      ? "송금하지 않는 것이 안전합니다. 특히 전화 확인을 피하거나 급한 송금을 요구하면 기존에 저장된 연락처로 직접 확인하세요."
      : "현재 정보만으로 송금 안전을 보장할 수 없습니다. 수취인과 거래 조건을 공식·독립 경로에서 확인한 뒤 결정하세요.";
  }
  if (/투자|리딩방|방.*들어|가입/u.test(question)) {
    return types.has("INVESTMENT_ROOM")
      ? "원금 보장·고수익 약속과 외부 거래소 유도 신호가 있어 이 방에 참여하거나 입금하지 않는 것이 안전합니다."
      : "투자방 참여 전 운영 주체와 금융회사 등록 여부를 공식 경로에서 확인하고 원금·수익 보장 표현이 있으면 참여하지 마세요.";
  }
  if (/사기|정상|위험/u.test(question)) return summary;
  return canProceed === "YES"
    ? `${summary} 행동 전 발신자와 내용을 독립적인 공식 경로에서 한 번 더 확인하세요.`
    : `${summary} 확인이 끝날 때까지 링크 클릭·송금·앱 설치·개인정보 입력을 진행하지 마세요.`;
}

export function buildFraudDecision(input: FraudDecisionInput): FraudDecision {
  const verdict = determineVerdict(input);
  const canProceed = determineCanProceed(verdict);
  const summary = decisionSummary(input, verdict);
  const evidenceSummary = input.reasons.length > 0
    ? [...input.reasons]
    : ["긴급 송금, 링크 인증, 앱 설치, 개인정보 요구 같은 뚜렷한 위험 조합이 확인되지 않았습니다."];
  return {
    decisionSummary: summary,
    verdict,
    canProceed,
    userQuestionAnswer: answerUserQuestion(input, canProceed, summary),
    verificationChecklist: buildVerificationChecklist(input),
    evidenceSummary,
    nextStepGuide: unique([...input.immediateActions, ...input.reportGuide]),
    incidentReportSummary: input.incidentReportSummary,
  };
}
