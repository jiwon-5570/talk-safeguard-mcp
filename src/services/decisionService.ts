import type {
  CanProceed,
  RiskLevel,
  ScamType,
  UserSituation,
  Verdict,
} from "../mcp/schemas.js";
import type { RiskIndicators } from "../utils/extractors.js";
import { detectQuestionIntent, type UserQuestionIntent } from "./questionIntentService.js";
import { scamTypeLabel } from "./safetyGuideService.js";

export interface FraudDecision {
  decisionSummary: string;
  verdict: Verdict;
  canProceed: CanProceed;
  userQuestionAnswer: string;
  evidenceSummary: string[];
  verificationChecklist: string[];
  doNotActions: string[];
  nextStepGuide: string[];
  incidentReportSummary: string;
}

export interface FraudDecisionInput {
  message: string;
  userQuestion?: string;
  userSituation: UserSituation;
  riskScore: number;
  riskLevel: RiskLevel;
  scamTypes: ScamType[];
  reasons: string[];
  indicators: RiskIndicators;
  immediateActions: string[];
  doNotActions: string[];
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

function determineVerdict(input: FraudDecisionInput, intent: UserQuestionIntent): Verdict {
  if (
    ["sent_money", "installed_app", "shared_info"].includes(input.userSituation)
    || intent === "ASK_AFTER_SENT_MONEY"
  ) {
    return "URGENT_ACTION";
  }
  if (input.userSituation === "clicked_link" || intent === "ASK_AFTER_CLICK") return "SUSPICIOUS";
  if (input.message.trim().length < 8 && input.reasons.length === 0) return "INSUFFICIENT_INFO";
  const decisiveType = input.scamTypes.some((type) => decisiveRiskTypes.has(type));
  if (input.riskLevel === "CRITICAL" || (input.riskLevel === "HIGH" && decisiveType)) {
    return "HIGHLY_SUSPICIOUS";
  }
  if (
    input.riskLevel === "HIGH"
    || (input.riskLevel === "MEDIUM" && input.reasons.length >= 2)
  ) {
    return "SUSPICIOUS";
  }
  if (
    input.riskLevel === "MEDIUM"
    || input.reasons.length > 0
    || intent === "ASK_ENTER_AUTH_CODE"
    || intent === "ASK_INSTALL_APP"
  ) {
    return "NEEDS_CAUTION";
  }
  return "SAFE_LIKELY";
}

function determineCanProceed(verdict: Verdict, intent: UserQuestionIntent): CanProceed {
  if (
    verdict === "URGENT_ACTION"
    || verdict === "HIGHLY_SUSPICIOUS"
    || verdict === "SUSPICIOUS"
    || intent === "ASK_ENTER_AUTH_CODE"
    || intent === "ASK_INSTALL_APP"
  ) {
    return "NO";
  }
  if (
    verdict === "INSUFFICIENT_INFO"
    || verdict === "NEEDS_CAUTION"
    || intent === "ASK_SEND_MONEY"
    || intent === "ASK_TRUST_SELLER"
    || intent === "ASK_JOIN_INVESTMENT"
  ) {
    return "CHECK_FIRST";
  }
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

function answerUserQuestion(
  input: FraudDecisionInput,
  intent: UserQuestionIntent,
  canProceed: CanProceed,
  summary: string,
): string {
  if (input.userSituation === "sent_money" || intent === "ASK_AFTER_SENT_MONEY") {
    return "추가 송금을 중단하고 즉시 해당 은행 고객센터에 지급정지 가능 여부를 문의하세요. 경찰 112와 금융감독원 1332에도 공식 절차를 확인하세요.";
  }
  if (input.userSituation === "installed_app") {
    return "의심 앱의 네트워크 연결을 끊고 추가 권한을 승인하지 마세요. 다른 안전한 기기로 금융기관과 112에 연락하고 휴대폰 보안 점검을 진행하세요.";
  }
  if (input.userSituation === "shared_info") {
    return "추가 정보 입력을 중단하고 다른 안전한 기기에서 같은 비밀번호를 사용하는 계정의 비밀번호를 변경하세요. 금융정보를 입력했다면 카드사나 은행 고객센터에 문의하세요.";
  }
  if (input.userSituation === "clicked_link" || intent === "ASK_AFTER_CLICK") {
    return "이미 링크를 눌렀다면 페이지를 닫고 개인정보 입력과 파일 다운로드를 중단하세요. 설치된 앱·프로필이 없는지 확인하고 비밀번호나 인증번호를 입력하지 마세요.";
  }
  if (intent === "ASK_TRUST_SELLER") {
    return "사업자번호가 있어도 거래 안전이 보장되지는 않습니다. 사업자 상태와 통신판매사업자 등록 여부를 확인하고, 개인계좌 선입금이나 안전결제 거부가 있으면 결제하지 않는 것이 안전합니다.";
  }
  if (intent === "ASK_OPEN_LINK") {
    return canProceed === "NO"
      ? "현재 메시지에는 링크 클릭을 유도하는 위험 신호가 있어 누르지 않는 것이 안전합니다. 공식 앱이나 공식 홈페이지에서 직접 확인하세요."
      : "뚜렷한 위험 신호가 적더라도 링크의 안전을 보장할 수 없습니다. 공식 앱이나 직접 입력한 공식 주소에서 먼저 확인하세요.";
  }
  if (intent === "ASK_SEND_MONEY") {
    return canProceed === "NO"
      ? "송금하지 않는 것이 안전합니다. 기존에 저장된 번호나 공식 연락처로 직접 확인하세요."
      : "현재 정보만으로 송금 안전을 보장할 수 없습니다. 수취인과 거래 조건을 공식·독립 경로에서 확인한 뒤 결정하세요.";
  }
  if (intent === "ASK_JOIN_INVESTMENT") {
    return input.scamTypes.includes("INVESTMENT_ROOM")
      ? "참여하지 않는 것이 안전합니다. 원금 보장, 매일 수익, 해외거래소 가입 유도는 강한 위험 신호입니다."
      : "투자방 참여 전 운영 주체와 금융회사 등록 여부를 공식 경로에서 확인하고 원금·수익 보장 표현이 있으면 참여하지 마세요.";
  }
  if (intent === "ASK_ENTER_AUTH_CODE") {
    return "인증번호나 OTP는 절대 전달하지 않는 것이 안전합니다. 계정 탈취나 금융 피해에 악용될 수 있습니다.";
  }
  if (intent === "ASK_INSTALL_APP") {
    return "설치하지 않는 것이 안전합니다. 공식 앱스토어와 공식 기관 안내가 아닌 앱 설치 요구는 위험 신호입니다.";
  }
  if (intent === "ASK_REPORT") return input.incidentReportSummary;
  if (intent === "ASK_IF_SCAM") return summary;
  if (canProceed === "CHECK_FIRST" && input.reasons.length === 0) {
    return "현재 정보만으로는 충분히 판단하기 어렵습니다. 링크, 송금 요구, 인증번호 요구, 보낸 사람, 사업자번호 여부 등을 추가로 확인해야 합니다.";
  }
  return canProceed === "YES"
    ? `${summary} 행동 전 발신자와 내용을 독립적인 공식 경로에서 한 번 더 확인하세요.`
    : `${summary} 확인이 끝날 때까지 링크 클릭·송금·앱 설치·개인정보 입력을 진행하지 마세요.`;
}

export function buildFraudDecision(input: FraudDecisionInput): FraudDecision {
  const intent = detectQuestionIntent(input.userQuestion, input.message);
  const verdict = determineVerdict(input, intent);
  const canProceed = determineCanProceed(verdict, intent);
  const summary = decisionSummary(input, verdict);
  const evidenceSummary = input.reasons.length > 0
    ? [...input.reasons]
    : ["긴급 송금, 링크 인증, 앱 설치, 개인정보 요구 같은 뚜렷한 위험 조합이 확인되지 않았습니다."];
  return {
    decisionSummary: summary,
    verdict,
    canProceed,
    userQuestionAnswer: answerUserQuestion(input, intent, canProceed, summary),
    evidenceSummary,
    verificationChecklist: buildVerificationChecklist(input),
    doNotActions: [...input.doNotActions],
    nextStepGuide: unique([...input.immediateActions, ...input.reportGuide]),
    incidentReportSummary: input.incidentReportSummary,
  };
}
