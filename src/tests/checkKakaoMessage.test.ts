import { describe, expect, it } from "vitest";
import { checkKakaoMessageTool } from "../mcp/tools/checkKakaoMessage.js";
import { TOOL_NAMES } from "../server.js";

describe("check_kakao_message", () => {
  it("대표 도구가 첫 번째로 등록되고 총 9개 도구를 유지한다", () => {
    expect(TOOL_NAMES[0]).toBe("check_kakao_message");
    expect(TOOL_NAMES).toHaveLength(9);
  });

  it("카카오페이 사칭 링크를 누르지 말라고 직접 답한다", () => {
    const result = checkKakaoMessageTool({
      message: "카카오페이 이벤트 당첨입니다. 아래 링크에서 본인인증하면 5만원 지급됩니다. http://kakao-pay-event.example.com",
      question: "이 링크 눌러도 돼?",
      userSituation: "before_click",
    });

    expect(result.canProceed).toBe("NO");
    expect(["SUSPICIOUS", "HIGHLY_SUSPICIOUS"]).toContain(result.verdict);
    expect(result.userQuestionAnswer).toContain("누르지 않는 것이 안전");
    expect(result.verificationChecklist.join(" ")).toMatch(/공식 앱|공식 홈페이지/);
    expect(result.relatedChecks.hasUrl).toBe(true);
  });

  it("가족 사칭 송금을 CRITICAL로 판단하고 중단시킨다", () => {
    const result = checkKakaoMessageTool({
      message: "엄마 나 폰 고장났어. 급하게 80만원 보내줘. 전화는 안 돼.",
      question: "송금해도 돼?",
      userSituation: "before_click",
    });

    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.canProceed).toBe("NO");
    expect(result.verdict).toBe("HIGHLY_SUSPICIOUS");
    expect(result.userQuestionAnswer).toContain("송금하지 않는 것이 안전");
    expect(result.relatedChecks.hasMoneyRequest).toBe(true);
  });

  it("사업자번호만으로 판매자를 신뢰하지 않도록 안내한다", () => {
    const result = checkKakaoMessageTool({
      message: "카톡 주문만 가능하고 개인계좌로 먼저 입금하면 배송해준대. 사업자번호는 123-45-67890이야.",
      question: "사업자번호 있으면 믿어도 돼?",
    });

    expect(["CHECK_FIRST", "NO"]).toContain(result.canProceed);
    expect(result.userQuestionAnswer).toContain("사업자번호가 있어도 거래 안전이 보장되지는 않습니다");
    expect(result.verificationChecklist.join(" ")).toContain("통신판매사업자");
    expect(result.relatedChecks.hasBusinessNumber).toBe(true);
  });

  it("고수익 투자방 참여를 중단시킨다", () => {
    const result = checkKakaoMessageTool({
      message: "무료 VIP 주식 리딩방 입장 가능. 원금 보장, 매일 5% 수익. 해외거래소 가입 링크 보내줄게.",
      question: "이 방 들어가도 돼?",
    });

    expect(result.canProceed).toBe("NO");
    expect(result.verdict).toBe("HIGHLY_SUSPICIOUS");
    expect(result.evidenceSummary.join(" ")).toMatch(/원금|수익/);
    expect(result.evidenceSummary.join(" ")).toContain("해외");
    expect(result.relatedChecks.hasInvestmentSignal).toBe(true);
  });

  it("정상 일상 메시지에 과도한 경고를 만들지 않는다", () => {
    const result = checkKakaoMessageTool({
      message: "오늘 저녁 7시에 가족방에서 여행 일정 이야기하자.",
      question: "이것도 사기야?",
    });

    expect(result.riskLevel).toBe("LOW");
    expect(["SAFE_LIKELY", "NEEDS_CAUTION"]).toContain(result.verdict);
    expect(["YES", "CHECK_FIRST"]).toContain(result.canProceed);
    expect(result.decisionSummary).toContain("뚜렷한 위험 신호는 거의");
  });

  it("이미 링크를 누른 경우 추가 입력 중단을 우선 안내한다", () => {
    const result = checkKakaoMessageTool({
      message: "택배 주소 오류입니다. 아래 링크에서 주소를 다시 입력하세요. http://delivery-check-kr.example.com",
      question: "이미 링크 눌렀는데 어떻게 해?",
      userSituation: "clicked_link",
    });

    expect(["URGENT_ACTION", "SUSPICIOUS"]).toContain(result.verdict);
    expect(result.canProceed).toBe("NO");
    expect(result.nextStepGuide.join(" ")).toMatch(/추가.*입력.*중단/);
  });
});
