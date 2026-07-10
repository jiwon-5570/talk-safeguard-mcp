import { describe, expect, it } from "vitest";
import { checkKakaoMessageTool } from "../mcp/tools/checkKakaoMessage.js";
import type { UserSituation } from "../mcp/schemas.js";

interface RealUserScenario {
  title: string;
  message: string;
  question: string;
  userSituation?: UserSituation;
  shouldStop?: boolean;
  shouldCheckPublicData?: boolean;
}

const scenarios: RealUserScenario[] = [
  {
    title: "카카오페이 이벤트 링크",
    message: "카카오페이 이벤트 당첨입니다. 아래 링크에서 본인인증하면 5만원 지급됩니다. http://kakao-pay-event.example.com",
    question: "이 링크 눌러도 돼?",
    shouldStop: true,
  },
  {
    title: "택배 주소 오류 링크",
    message: "택배 주소 오류입니다. 오늘 안에 http://delivery-check-kr.example.com 에서 주소를 다시 입력하세요.",
    question: "들어가도 돼?",
    shouldStop: true,
  },
  {
    title: "부고장 링크",
    message: "부고장 전달드립니다. 자세한 내용은 http://obituary-notice.example.com 에서 확인 부탁드립니다.",
    question: "열어봐도 돼?",
    shouldStop: true,
  },
  {
    title: "청첩장 링크",
    message: "모바일 청첩장 보냅니다. http://wedding-card.example.com 확인해 주세요.",
    question: "클릭해도 돼?",
    shouldStop: true,
  },
  {
    title: "과태료 미납 링크",
    message: "경찰청 교통 과태료 미납 안내입니다. http://fine-check.example.com 에서 납부하세요.",
    question: "납부 링크 들어가도 돼?",
    shouldStop: true,
  },
  {
    title: "건강검진 안내 링크",
    message: "국민건강보험 건강검진 대상자입니다. 자세한 내용은 http://health-check.example.com 에서 확인하세요.",
    question: "이 링크 눌러도 돼?",
  },
  {
    title: "가족 사칭 긴급 송금",
    message: "엄마 나 폰 고장났어. 지금 통화 안 돼. 급하게 80만원 보내줘.",
    question: "송금해도 돼?",
    shouldStop: true,
  },
  {
    title: "친구 사칭 상품권 요청",
    message: "오빠야. 나 회의 중이라 전화 안 돼. 문화상품권 30만원만 사서 핀번호 사진 보내줘.",
    question: "사줘도 돼?",
    shouldStop: true,
  },
  {
    title: "검찰 사칭 안전계좌",
    message: "검찰청입니다. 계좌가 범죄에 연루되어 안전계좌로 자금을 이체해 검사해야 합니다.",
    question: "이체해도 돼?",
    shouldStop: true,
  },
  {
    title: "경찰 사칭 인증번호",
    message: "경찰청 수사 협조입니다. 본인확인을 위해 인증번호와 OTP를 알려주세요.",
    question: "인증번호 알려줘도 돼?",
    shouldStop: true,
  },
  {
    title: "보안 앱 설치 요구",
    message: "금융사고 예방을 위해 원격제어 보안 앱을 설치하고 권한을 모두 허용하세요.",
    question: "앱 설치해도 돼?",
    shouldStop: true,
  },
  {
    title: "팀뷰어 설치 요구",
    message: "계좌 보호를 위해 팀뷰어를 설치하면 상담원이 원격으로 도와드립니다.",
    question: "깔아도 돼?",
    shouldStop: true,
  },
  {
    title: "계정 제한 인증번호",
    message: "카카오 계정이 제한되었습니다. 아래 링크에서 비밀번호와 인증번호를 입력하세요. http://kakao-security.example.com",
    question: "입력해도 돼?",
    shouldStop: true,
  },
  {
    title: "OTP 전달 요구",
    message: "본인확인 완료를 위해 OTP 번호를 상담원에게 전달해 주세요.",
    question: "보내도 돼?",
    shouldStop: true,
  },
  {
    title: "리딩방 원금 보장",
    message: "VIP 주식 리딩방입니다. 원금 보장, 매일 5% 수익, 해외거래소 가입 링크 드립니다.",
    question: "이 방 들어가도 돼?",
    shouldStop: true,
  },
  {
    title: "코인 선물 수익방",
    message: "코인방 입장하면 손실 없음. 코인 선물로 매일 수익 보장 가능합니다.",
    question: "가입해도 돼?",
    shouldStop: true,
  },
  {
    title: "대출 수수료 선입금",
    message: "저금리 대출 승인됐습니다. 보증료 20만원을 3333021234567 계좌로 먼저 입금하면 바로 실행됩니다.",
    question: "입금해도 돼?",
    shouldStop: true,
  },
  {
    title: "개인계좌 선입금 쇼핑몰",
    message: "명품 공동구매 특가입니다. 카톡 주문만 가능하고 개인계좌로 선입금하면 배송합니다.",
    question: "구매해도 돼?",
    shouldCheckPublicData: true,
  },
  {
    title: "사업자번호 있는 쇼핑몰",
    message: "상점 사업자등록번호는 123-45-67890입니다. 개인계좌 입금만 받고 안전결제는 어렵습니다.",
    question: "사업자번호 있으면 믿어도 돼?",
    shouldCheckPublicData: true,
  },
  {
    title: "중고거래 예약금",
    message: "중고 노트북 예약하려면 먼저 예약금 10만원 입금해 주세요. 안전결제는 안 합니다.",
    question: "거래해도 돼?",
    shouldCheckPublicData: true,
  },
  {
    title: "공동구매 판매자",
    message: "공구 진행 중이고 사업자번호는 나중에 알려줄게요. 지금 개인계좌로 입금해야 물량 잡습니다.",
    question: "이 판매자 믿을만해?",
    shouldCheckPublicData: true,
  },
  {
    title: "이미 링크를 누른 상황",
    message: "택배 주소 오류 링크를 눌렀는데 개인정보 입력 화면이 나왔습니다.",
    question: "이미 링크 눌렀어. 어떻게 해?",
    userSituation: "clicked_link",
    shouldStop: true,
  },
  {
    title: "이미 돈을 보낸 상황",
    message: "엄마라고 해서 80만원을 보냈는데 전화해보니 아니래요.",
    question: "이미 돈 보냈어. 어떻게 해야 해?",
    userSituation: "sent_money",
    shouldStop: true,
  },
  {
    title: "이미 앱을 설치한 상황",
    message: "보안 앱을 설치하고 권한을 허용했는데 이상합니다.",
    question: "이미 설치했어. 어떻게 해?",
    userSituation: "installed_app",
    shouldStop: true,
  },
  {
    title: "이미 개인정보를 입력한 상황",
    message: "카카오 계정 확인 링크에서 비밀번호와 생년월일을 입력했습니다.",
    question: "정보 입력했는데 어떻게 해?",
    userSituation: "shared_info",
    shouldStop: true,
  },
  {
    title: "신고용 요약 요청",
    message: "검찰청이라며 안전계좌로 이체하라고 했고 원격제어 앱 설치도 요구했습니다.",
    question: "경찰에 신고용 요약 만들어줘",
    shouldStop: true,
  },
  {
    title: "부모님 설명용 요청",
    message: "카카오페이 포인트 지급이라며 링크에서 본인인증을 하라고 합니다. http://pay-reward.example.com",
    question: "부모님께 설명할 공유용 요약 만들어줘",
    shouldStop: true,
  },
  {
    title: "가족방 공유용 요청",
    message: "엄마 나 폰 고장났어. 편의점 상품권 사서 번호를 보내줘.",
    question: "가족에게 설명할 문장 줘",
    shouldStop: true,
  },
  {
    title: "안전한 일상 약속",
    message: "오늘 저녁 7시에 가족방에서 여행 일정 이야기하자.",
    question: "이것도 사기야?",
  },
  {
    title: "일반 업무 안내",
    message: "내일 회의 자료는 사내 드라이브에 올려두겠습니다.",
    question: "위험해?",
  },
  {
    title: "링크 없는 택배 알림",
    message: "택배가 오늘 오후 배송 예정입니다. 운송장 번호는 앱에서 확인하세요.",
    question: "괜찮아?",
  },
  {
    title: "공식 앱 확인 안내",
    message: "카카오톡 앱 안의 설정 메뉴에서 보안 알림을 확인해 주세요.",
    question: "정상 맞아?",
  },
  {
    title: "상담원이 안전결제 거부",
    message: "스토어 판매자인데 안전결제는 수수료 때문에 안 되고 개인계좌로만 받습니다.",
    question: "결제해도 돼?",
    shouldCheckPublicData: true,
  },
  {
    title: "입금 인증 요구 투자방",
    message: "무료 리딩방입니다. 입금 인증하면 프리미엄 종목과 급등주 정보를 드립니다.",
    question: "투자해도 돼?",
    shouldStop: true,
  },
  {
    title: "계좌번호 포함 선입금",
    message: "오늘만 특가라서 3333021234567 계좌로 먼저 입금해야 합니다.",
    question: "돈 보내도 돼?",
    shouldStop: true,
  },
  {
    title: "파일 다운로드 유도 청첩장",
    message: "청첩장 확인 파일을 다운로드해 설치하면 자세한 장소가 나옵니다. http://invite-file.example.com",
    question: "다운로드해도 돼?",
    shouldStop: true,
  },
];

describe("실제 사용자 대표 시나리오", () => {
  it.each(scenarios)("$title 질문에 결론·공유·공식확인 중심 응답을 반환한다", (scenario) => {
    const result = checkKakaoMessageTool({
      message: scenario.message,
      question: scenario.question,
      ...(scenario.userSituation === undefined ? {} : { userSituation: scenario.userSituation }),
    });

    expect(result.answerHeadline).toMatch(/^결론:/u);
    expect(result.simpleConclusion.length).toBeGreaterThan(10);
    expect(result.shareSummary).toMatch(/^공유용 요약:/u);
    expect(result.emergencyAction).toMatch(/^지금 할 일:/u);
    expect(result.officialCheckSteps.length).toBeGreaterThan(0);
    expect(result.publicDataSources).toContain("통신 빅데이터 플랫폼 불법 스팸 URL 공식 CSV 데이터셋");
    expect(result.userQuestionAnswer.length).toBeGreaterThan(10);
    expect(result.verificationChecklist.length).toBeGreaterThan(0);
    expect(result.nextStepGuide.length).toBeGreaterThan(0);

    if (scenario.shouldStop === true) {
      expect(result.canProceed).toBe("NO");
      expect(result.answerHeadline).toMatch(/누르지|송금하지|설치하지|입력하거나 전달하지|들어가지|하지 마세요|멈추고|진행하지/u);
      expect(result.emergencyAction).toMatch(/중단|멈추/u);
    }

    if (scenario.shouldCheckPublicData === true) {
      expect(["CHECK_FIRST", "NO"]).toContain(result.canProceed);
      expect(result.officialCheckSteps.join(" ")).toMatch(/국세청|공정거래위원회|공식/u);
      expect(result.publicDataSources.join(" ")).toMatch(/국세청|공정거래위원회/u);
    }
  });
});
