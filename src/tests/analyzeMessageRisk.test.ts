import { describe, expect, it } from "vitest";
import { analyzeMessageRiskTool } from "../mcp/tools/analyzeMessageRisk.js";

describe("analyze_message_risk", () => {
  it("가족 사칭과 송금·전화 회피 조합을 CRITICAL로 판단한다", () => {
    const result = analyzeMessageRiskTool({
      message: "엄마 나 폰 고장났어. 급하게 80만원만 이 계좌로 보내줘. 전화는 안 돼.",
      userSituation: "before_click",
    });

    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.scamTypes).toContain("FAMILY_IMPERSONATION");
    expect(result.prohibitedActions.join(" ")).toContain("송금");
    expect(result.recommendedActions.join(" ")).toContain("기존에 저장된");
  });

  it("투자 리딩방의 보장·고수익·해외거래소 조합을 CRITICAL로 판단한다", () => {
    const result = analyzeMessageRiskTool({
      message: "무료 VIP 주식 리딩방 입장. 원금 보장, 매일 5% 수익. 해외거래소 가입하면 바로 수익 납니다.",
    });

    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.scamTypes).toContain("INVESTMENT_ROOM");
    expect(result.reasons.join(" ")).toMatch(/원금|수익/);
    expect(result.reasons.join(" ")).toContain("해외");
  });

  it("택배 주소 입력 링크를 HIGH 이상으로 판단한다", () => {
    const result = analyzeMessageRiskTool({
      message: "택배 주소 오류입니다. 아래 링크에서 주소를 다시 입력하세요. http://delivery-check-kr.example.com",
      userSituation: "before_click",
    });

    expect(["HIGH", "CRITICAL"]).toContain(result.riskLevel);
    expect(result.scamTypes).toContain("DELIVERY_SMISHING");
    expect(result.prohibitedActions.join(" ")).toContain("링크");
  });

  it("개인계좌 쇼핑 선입금을 MEDIUM 이상으로 판단한다", () => {
    const result = analyzeMessageRiskTool({
      message: "카톡 주문만 가능합니다. 개인계좌로 입금하면 바로 배송합니다. 사업자번호 123-45-67890",
    });

    expect(["MEDIUM", "HIGH", "CRITICAL"]).toContain(result.riskLevel);
    expect(result.scamTypes).toContain("SHOPPING_PREPAYMENT");
    expect(result.recommendedActions.join(" ")).toMatch(/사업자등록|통신판매업/);
  });

  it("일상 메시지에는 과도한 경고를 만들지 않는다", () => {
    const result = analyzeMessageRiskTool({ message: "오늘 저녁 7시에 가족방에서 여행 일정 이야기하자." });

    expect(result.riskLevel).toBe("LOW");
    expect(result.riskScore).toBeLessThan(30);
    expect(result.scamTypes).toEqual(["UNKNOWN_RISK"]);
  });

  it("카카오페이 이벤트 사칭과 본인인증 링크를 HIGH 이상으로 판단한다", () => {
    const result = analyzeMessageRiskTool({
      message: "카카오페이 이벤트 당첨입니다. 아래 링크에서 본인인증하면 5만원 지급됩니다. http://kakao-pay-event.example.com",
      userSituation: "before_click",
    });

    expect(["HIGH", "CRITICAL"]).toContain(result.riskLevel);
    expect(result.scamTypes).toContain("KAKAO_BRAND_IMPERSONATION");
    expect(result.prohibitedActions.join(" ")).toContain("링크");
    expect(result.reasons.join(" ")).toContain("본인");
    expect(result.urlChecks.length).toBeGreaterThan(0);
  });

  it("실제 URL 없이 링크만 언급하면 URL 검사 불가로 응답한다", () => {
    const result = analyzeMessageRiskTool({
      message: "카카오페이 이벤트 당첨이라며 링크가 왔어.",
      userQuestion: "이 링크 눌러도 돼?",
    });

    expect(result.verdict).toBe("INSUFFICIENT_INFO");
    expect(result.canProceed).toBe("CHECK_FIRST");
    expect(result.inputWarnings.join(" ")).toContain("실제 URL 문자열이 없어");
    expect(result.urlChecks).toHaveLength(0);
    expect(result.userQuestionAnswer).toContain("URL 안전성을 테스트할 수 없습니다");
  });

  it("모바일 부고 링크를 HIGH 이상으로 판단한다", () => {
    const result = analyzeMessageRiskTool({
      message: "모바일 부고장입니다. 아래 링크에서 장례식장 위치를 확인하세요. http://obituary-check.example.com",
      userSituation: "before_click",
    });

    expect(["HIGH", "CRITICAL"]).toContain(result.riskLevel);
    expect(result.scamTypes).toContain("INVITATION_SMISHING");
    expect(result.reasons.join(" ")).toContain("부고");
  });

  it("가족 사칭 상품권 핀번호 요구를 CRITICAL로 판단한다", () => {
    const result = analyzeMessageRiskTool({
      message: "엄마 나 폰 고장났어. 편의점에서 구글 기프트카드 30만원만 사서 핀번호 사진 보내줘. 전화는 안 돼.",
      userSituation: "before_click",
    });

    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.scamTypes).toContain("GIFT_CARD_SCAM");
    expect(result.recommendedActions.join(" ")).toMatch(/상품권|핀번호/);
  });

  it("계정 제한 해제를 가장한 비밀번호·인증번호 요구를 CRITICAL로 판단한다", () => {
    const result = analyzeMessageRiskTool({
      message: "카카오톡 계정 이용이 제한되었습니다. 아래 링크에서 비밀번호와 인증번호를 입력해 해제하세요. http://kakao-account.example.com",
      userSituation: "before_click",
    });

    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.scamTypes).toContain("ACCOUNT_TAKEOVER");
    expect(result.recommendedActions.join(" ")).toMatch(/비밀번호|인증번호/);
  });

  it.each([
    "오늘 저녁 7시에 가족방에서 여행 일정 이야기하자.",
    "택배 도착했어. 문 앞에 뒀대.",
    "다음 주에 은행 가서 상담받자.",
    "주식 공부 모임에서 경제 뉴스 같이 읽어보자.",
    "카카오페이로 내가 밥값 보낼게.",
    "청첩장 디자인 같이 골라줘.",
  ])("정상 문장을 LOW로 유지한다: %s", (message) => {
    const result = analyzeMessageRiskTool({ message });
    expect(result.riskLevel).toBe("LOW");
  });
});
