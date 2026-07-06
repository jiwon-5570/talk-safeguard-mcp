import type { RiskLevel, ScamType, UserSituation } from "../mcp/schemas.js";
import { INCIDENT_SAFETY_MESSAGE, SAFETY_MESSAGE } from "../mcp/responses.js";

export interface SafetyGuide {
  immediateActions: string[];
  doNotActions: string[];
  reportGuide: string[];
  familyShareMessage: string;
  reportSummaryTemplate: string;
  safetyMessage: string;
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

export function generateSafetyGuide(
  userSituation: UserSituation,
  riskLevel: RiskLevel,
  scamType: ScamType = "UNKNOWN_RISK",
): SafetyGuide {
  const urgentIncident = ["sent_money", "installed_app", "shared_info"].includes(userSituation);
  const typeSpecificActions = scamType === "FAMILY_IMPERSONATION"
    ? ["메시지에 나온 번호가 아니라 기존에 저장된 가족·지인의 번호로 직접 전화해 확인하세요."]
    : scamType === "SHOPPING_PREPAYMENT" || scamType === "USED_MARKET_PREPAYMENT"
      ? ["사업자등록과 통신판매업 신고를 공식 경로에서 확인하고 개인계좌 선입금 대신 구매자 보호 결제를 사용하세요."]
      : scamType === "INVESTMENT_ROOM"
        ? ["금융감독원 파인 등 공식 경로에서 제도권 금융회사 여부를 확인하세요."]
        : [];
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

  return {
    immediateActions: [...situationActions[userSituation], ...typeSpecificActions],
    doNotActions: situationDoNot[userSituation],
    reportGuide,
    familyShareMessage: `[공유용 안전 알림] 이 메시지에서 ${levelLabel(riskLevel)} 수준의 사기 위험 신호가 감지되었습니다. 링크·송금·앱 설치·개인정보 입력을 멈추고, 메시지에 적힌 연락처가 아닌 기존 연락처나 공식 대표번호로 직접 확인해 주세요.`,
    reportSummaryTemplate: `[상담·신고용 요약] 의심 유형: ${scamType} / 위험 수준: ${riskLevel} / 발생 시각: [작성] / 수행한 행동: [클릭·송금·설치·정보 제공 여부] / 보유 증빙: [대화 캡처·URL·송금 내역]`,
    safetyMessage: urgentIncident ? INCIDENT_SAFETY_MESSAGE : SAFETY_MESSAGE,
  };
}
