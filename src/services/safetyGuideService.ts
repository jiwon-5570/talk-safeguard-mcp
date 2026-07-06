import type { CanProceed, ReceivedVia, RiskLevel, ScamType, UserSituation } from "../mcp/schemas.js";
import { INCIDENT_SAFETY_MESSAGE, SAFETY_MESSAGE } from "../mcp/responses.js";

export interface SafetyGuide {
  situationSummary: string;
  canProceed: CanProceed;
  immediateActions: string[];
  doNotActions: string[];
  verificationChecklist: string[];
  reportGuide: string[];
  incidentReportSummary: string;
  /** @deprecated 하위 호환 필드. decisionSummary와 nextStepGuide를 사용하세요. */
  familyShareMessage: string;
  /** @deprecated incidentReportSummary를 사용하세요. */
  reportSummaryTemplate: string;
  safetyMessage: string;
}

export interface SafetyGuideContext {
  hasUrl?: boolean;
  transferRequested?: boolean;
  appInstallRequested?: boolean;
  sensitiveInfoRequested?: boolean;
  receivedVia?: ReceivedVia;
}

const situationActions: Record<UserSituation, string[]> = {
  before_click: [
    "메시지 속 링크 대신 공식 앱 또는 직접 입력한 공식 주소로 사실을 확인하세요.",
    "가족·지인 사칭이 의심되면 기존에 저장된 번호로 직접 전화하세요.",
  ],
  clicked_link: [
    "페이지를 닫고 추가 정보 입력과 파일 다운로드를 중단하세요.",
    "새 앱이나 프로필이 설치되었는지 확인하고 모바일 백신으로 점검하세요.",
    "발신자가 주장하는 기관의 공식 대표번호로 사실을 확인하세요.",
  ],
  sent_money: [
    "즉시 해당 은행 고객센터에 연락해 지급정지 가능 여부를 문의하세요.",
    "경찰 112와 금융감독원 1332에 피해 사실과 대응 절차를 문의하세요.",
    "송금 시각·금액·대화·계좌 정보를 삭제하지 말고 증빙으로 보존하세요.",
  ],
  installed_app: [
    "의심 앱의 네트워크 접근을 차단하고 다른 안전한 기기로 112 또는 금융기관에 연락하세요.",
    "원격제어·출처 불명 앱을 제거하고 휴대폰 보안 점검을 진행하세요.",
    "다른 안전한 기기에서 금융앱과 주요 계정 비밀번호를 변경하세요.",
  ],
  shared_info: [
    "다른 안전한 기기에서 노출된 계정의 비밀번호를 즉시 변경하세요.",
    "카드사·은행 고객센터에 연락해 카드·계좌 보호 조치를 문의하세요.",
    "추가 인증번호 요청이나 후속 연락에 응답하지 마세요.",
  ],
  unknown: ["메시지와 별개의 공식 경로에서 발신 내용과 연락처를 교차 확인하세요."],
};

const situationDoNot: Record<UserSituation, string[]> = {
  before_click: ["링크를 클릭하지 마세요.", "송금·앱 설치·개인정보 입력을 진행하지 마세요."],
  clicked_link: ["인증번호·비밀번호·신분증·카드 정보를 추가로 입력하지 마세요.", "안내된 앱을 설치하지 마세요."],
  sent_money: ["상대방의 환급·수수료 명목 추가 송금 요구에 응하지 마세요.", "대화와 송금 증빙을 삭제하지 마세요."],
  installed_app: ["의심 기기에서 금융앱 로그인이나 비밀번호 변경을 진행하지 마세요.", "원격제어 요청을 추가 승인하지 마세요."],
  shared_info: ["추가 개인정보나 인증번호를 전달하지 마세요.", "같은 비밀번호를 계속 사용하지 마세요."],
  unknown: ["공식 확인 전에는 송금·앱 설치·민감정보 입력을 진행하지 마세요."],
};

function levelLabel(level: RiskLevel): string {
  return { LOW: "낮음", MEDIUM: "주의", HIGH: "높음", CRITICAL: "매우 높음" }[level];
}

const typeLabels: Record<ScamType, string> = {
  FAMILY_IMPERSONATION: "가족·지인 사칭 메신저피싱 가능성",
  AGENCY_IMPERSONATION: "기관 사칭 가능성",
  KAKAO_BRAND_IMPERSONATION: "카카오·카카오페이 사칭 가능성",
  DELIVERY_SMISHING: "택배·배송 안내 스미싱 가능성",
  INVITATION_SMISHING: "모바일 청첩장·부고 스미싱 가능성",
  PUBLIC_NOTICE_SMISHING: "공공기관·과태료 안내 스미싱 가능성",
  LOAN_SCAM: "대출 사기 가능성",
  INVESTMENT_ROOM: "투자 리딩방 위험 가능성",
  SHOPPING_PREPAYMENT: "카톡 주문·쇼핑 선입금 위험 가능성",
  USED_MARKET_PREPAYMENT: "중고거래 선입금 위험 가능성",
  GIFT_CARD_SCAM: "상품권 구매·핀번호 요구 사기 가능성",
  ACCOUNT_TAKEOVER: "계정 탈취 시도 가능성",
  AUTH_CODE_REQUEST: "인증번호 탈취 가능성",
  REMOTE_APP_INSTALL: "원격제어·악성 앱 설치 가능성",
  UNKNOWN_RISK: "미분류 위험 신호",
};

export function scamTypeLabel(scamType: ScamType): string {
  return typeLabels[scamType];
}

const situationLabels: Record<UserSituation, string> = {
  before_click: "링크 클릭·송금 전",
  clicked_link: "링크 클릭 후",
  sent_money: "송금 후",
  installed_app: "앱 설치 후",
  shared_info: "개인정보·인증정보 제공 후",
  unknown: "미확인",
};

const receivedViaLabels: Record<ReceivedVia, string> = {
  kakao: "카카오톡",
  open_chat: "오픈채팅",
  group_chat: "단톡방",
  direct_chat: "개인톡",
  unknown: "미확인",
};

function typeSpecificActions(scamType: ScamType): string[] {
  if (scamType === "FAMILY_IMPERSONATION") {
    return ["메시지에 나온 번호가 아니라 기존에 저장된 가족·지인의 번호로 직접 전화해 확인하세요."];
  }
  if (scamType === "GIFT_CARD_SCAM") {
    return ["상품권 구매와 핀번호·상품권 번호 전달을 중단하고 기존 연락처로 요청자를 직접 확인하세요."];
  }
  if (scamType === "SHOPPING_PREPAYMENT" || scamType === "USED_MARKET_PREPAYMENT") {
    return ["사업자등록과 통신판매업 신고를 공식 경로에서 확인하고 개인계좌 선입금 대신 구매자 보호 결제를 사용하세요."];
  }
  if (scamType === "INVESTMENT_ROOM") {
    return ["금융감독원 파인 등 공식 경로에서 제도권 금융회사 여부를 확인하세요."];
  }
  if (scamType === "ACCOUNT_TAKEOVER" || scamType === "AUTH_CODE_REQUEST") {
    return ["메시지 속 링크에 비밀번호나 인증번호를 입력하지 말고 공식 앱에서 계정 상태를 직접 확인하세요."];
  }
  if (scamType === "KAKAO_BRAND_IMPERSONATION") {
    return ["이벤트 링크를 열지 말고 카카오 공식 앱의 공지·이벤트 화면에서 사실 여부를 확인하세요."];
  }
  return [];
}

function verificationChecklist(scamType: ScamType): string[] {
  const checklist = ["메시지와 별개의 공식 앱·공식 홈페이지·대표번호에서 내용을 직접 확인하세요."];
  if (scamType === "FAMILY_IMPERSONATION" || scamType === "GIFT_CARD_SCAM") {
    checklist.push("기존에 저장된 가족·지인 번호로 직접 전화해 요청 사실을 확인하세요.");
  }
  if (scamType === "SHOPPING_PREPAYMENT" || scamType === "USED_MARKET_PREPAYMENT") {
    checklist.push("사업자등록·통신판매업 정보를 확인하고 안전결제 가능 여부를 확인하세요.");
  }
  if (scamType === "INVESTMENT_ROOM") {
    checklist.push("금융감독원 파인에서 제도권 금융회사 여부와 원금·수익 보장 표현을 확인하세요.");
  }
  if (["ACCOUNT_TAKEOVER", "AUTH_CODE_REQUEST", "KAKAO_BRAND_IMPERSONATION"].includes(scamType)) {
    checklist.push("카카오 공식 앱의 계정·보안 화면에서 제한이나 이벤트 여부를 확인하세요.");
  }
  return checklist;
}

function guideCanProceed(userSituation: UserSituation, riskLevel: RiskLevel): CanProceed {
  if (["clicked_link", "sent_money", "installed_app", "shared_info"].includes(userSituation)) return "NO";
  if (riskLevel === "HIGH" || riskLevel === "CRITICAL") return "NO";
  if (riskLevel === "MEDIUM") return "CHECK_FIRST";
  return "YES";
}

export function generateSafetyGuide(
  userSituation: UserSituation,
  riskLevel: RiskLevel,
  scamType: ScamType = "UNKNOWN_RISK",
  context: SafetyGuideContext = {},
): SafetyGuide {
  const urgentIncident = ["sent_money", "installed_app", "shared_info"].includes(userSituation);
  const typeActions = typeSpecificActions(scamType);
  const reportGuide = urgentIncident || riskLevel === "CRITICAL"
    ? [
        "긴급하거나 진행 중인 피해는 경찰 112에 신고하세요.",
        "금융 피해는 해당 은행 고객센터와 금융감독원 1332에 문의하세요.",
        "URL·발신 정보·대화 캡처·송금 내역·발생 시각을 정리하세요.",
      ]
    : [
        "의심 메시지는 한국인터넷진흥원 118 등 공식 상담 경로에서 확인할 수 있습니다.",
        "신고가 필요할 경우 대화 캡처·URL·발생 시각을 보존하세요.",
      ];
  const incidentReportSummary = [
    "[상담/신고용 요약]",
    `- 의심 유형: ${scamTypeLabel(scamType)}`,
    `- 위험 수준: ${riskLevel} (${levelLabel(riskLevel)})`,
    `- 받은 경로: ${receivedViaLabels[context.receivedVia ?? "unknown"]}`,
    `- 포함 요소: 링크 ${context.hasUrl === true ? "있음" : "없음 또는 미확인"} / 송금 요구 ${context.transferRequested === true ? "있음" : "없음 또는 미확인"} / 앱 설치 요구 ${context.appInstallRequested === true ? "있음" : "없음 또는 미확인"} / 인증번호·개인정보 요구 ${context.sensitiveInfoRequested === true ? "있음" : "없음 또는 미확인"}`,
    `- 현재 상황: ${situationLabels[userSituation]}`,
    `- 권장 조치: ${urgentIncident || riskLevel === "CRITICAL" ? "추가 행동을 중단하고 은행 고객센터·경찰 112·금융감독원 1332 등 공식 경로에 즉시 문의" : "링크·송금을 중단하고 기존 연락처 또는 공식 대표번호로 사실 확인"}`,
    "- 개인정보 처리: 이 서버는 메시지 원문을 저장하지 않음",
  ].join("\n");

  return {
    situationSummary: `현재 상황은 ${situationLabels[userSituation]}이며 위험 수준은 ${levelLabel(riskLevel)}입니다.`,
    canProceed: guideCanProceed(userSituation, riskLevel),
    immediateActions: [...situationActions[userSituation], ...typeActions],
    doNotActions: situationDoNot[userSituation],
    verificationChecklist: verificationChecklist(scamType),
    reportGuide,
    incidentReportSummary,
    familyShareMessage: "이 필드는 하위 호환을 위해 유지됩니다. 핵심 안내는 decisionSummary와 nextStepGuide를 확인하세요.",
    reportSummaryTemplate: incidentReportSummary,
    safetyMessage: urgentIncident ? INCIDENT_SAFETY_MESSAGE : SAFETY_MESSAGE,
  };
}
