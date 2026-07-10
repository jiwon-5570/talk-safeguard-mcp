import { describe, expect, it } from "vitest";
import { analyzeMessageRiskTool } from "../mcp/tools/analyzeMessageRisk.js";
import { checkInvestmentRoomRiskTool } from "../mcp/tools/checkInvestmentRoomRisk.js";
import { checkPhishingUrlTool } from "../mcp/tools/checkPhishingUrl.js";
import { generateSafeActionGuideTool } from "../mcp/tools/generateSafeActionGuide.js";
import { verifyBusinessInfoTool } from "../mcp/tools/verifyBusinessInfo.js";
import { verifyOnlineSellerTool } from "../mcp/tools/verifyOnlineSeller.js";

describe("사기 확인 중심 UX", () => {
  it("카카오페이 사칭 링크를 누르지 말라고 직접 답한다", () => {
    const result = analyzeMessageRiskTool({
      message: "카카오페이 이벤트 당첨입니다. 아래 링크에서 본인인증하면 5만원 지급됩니다. http://kakao-pay-event.example.com",
      userQuestion: "이 링크 눌러도 돼?",
      userSituation: "before_click",
    });

    expect(result.canProceed).toBe("NO");
    expect(["SUSPICIOUS", "HIGHLY_SUSPICIOUS"]).toContain(result.verdict);
    expect(result.userQuestionAnswer).toContain("누르지 않는 것이 안전");
    expect(result.verificationChecklist.join(" ")).toContain("도메인");
  });

  it("가족 사칭 송금을 중단하라고 직접 답한다", () => {
    const result = analyzeMessageRiskTool({
      message: "엄마 나 폰 고장났어. 급하게 80만원 보내줘. 전화는 안 돼.",
      userQuestion: "송금해도 돼?",
      userSituation: "before_click",
    });

    expect(result.canProceed).toBe("NO");
    expect(result.verdict).toBe("HIGHLY_SUSPICIOUS");
    expect(result.userQuestionAnswer).toContain("송금하지 않는 것이 안전");
    expect(result.evidenceSummary.join(" ")).toMatch(/송금|전화/);
  });

  it("사업자번호만으로 판매자를 신뢰하지 않도록 안내한다", () => {
    const result = analyzeMessageRiskTool({
      message: "카톡 주문만 가능하고 개인계좌로 먼저 입금하면 배송해준대. 사업자번호는 123-45-67890이야.",
      userQuestion: "사업자번호 있으면 믿어도 돼?",
      userSituation: "before_click",
    });

    expect(["CHECK_FIRST", "NO"]).toContain(result.canProceed);
    expect(result.userQuestionAnswer).toContain("거래 안전이 보장되지는 않습니다");
    expect(result.userQuestionAnswer).toContain("개인계좌 선입금");
  });

  it("정상 일상 메시지는 과도하게 경고하지 않는다", () => {
    const result = analyzeMessageRiskTool({
      message: "오늘 저녁 7시에 가족방에서 여행 일정 이야기하자.",
      userQuestion: "이것도 사기야?",
    });

    expect(result.riskLevel).toBe("LOW");
    expect(["SAFE_LIKELY", "NEEDS_CAUTION"]).toContain(result.verdict);
    expect(["YES", "CHECK_FIRST"]).toContain(result.canProceed);
    expect(result.decisionSummary).toContain("뚜렷한 위험 신호는 거의");
  });

  it("투자 리딩방 참여와 입금을 모두 중단하도록 안내한다", () => {
    const message = "무료 VIP 주식 리딩방 입장 가능. 원금 보장, 매일 5% 수익. 해외거래소 가입 링크 보내줄게.";
    const result = analyzeMessageRiskTool({ message, userQuestion: "이 방 들어가도 돼?" });
    const investment = checkInvestmentRoomRiskTool({ message });

    expect(result.canProceed).toBe("NO");
    expect(investment.canJoinRoom).toBe("NO");
    expect(investment.canDepositMoney).toBe("NO");
    expect(investment.redFlags.join(" ")).toMatch(/원금 보장|고수익|해외거래소/);
  });

  it("URL·사업자·판매자 도구가 행동 가능 여부를 직접 반환한다", async () => {
    const url = checkPhishingUrlTool({ url: "http://kakao-pay-event.example.com/verify" });
    const business = await verifyBusinessInfoTool({ businessRegistrationNumber: "123-45-67890" });
    const seller = await verifyOnlineSellerTool({ businessRegistrationNumber: "123-45-67890" });

    expect(url.canOpen).toBe("NO");
    expect(url.urlDecision).toContain("누르지 않는 것이 안전");
    expect(business.canTrustSeller).toBe("CHECK_FIRST");
    expect(business.remainingRisks.join(" ")).toContain("거래 안전을 보장하지 않습니다");
    expect(seller.canProceedWithPurchase).toBe("CHECK_FIRST");
    expect(seller.safePurchaseChecklist.length).toBeGreaterThan(2);
    expect(business.warnings.join(" ")).not.toMatch(/샘플|sample|데모/u);
    expect(seller.warnings.join(" ")).not.toMatch(/샘플|sample|데모/u);
  });

  it("상황별 행동 가이드가 공유문보다 행동·확인·신고를 우선한다", () => {
    const result = generateSafeActionGuideTool({
      userSituation: "clicked_link",
      riskLevel: "HIGH",
      scamType: "ACCOUNT_TAKEOVER",
    });

    expect(result.situationSummary).toContain("링크 클릭 후");
    expect(result.canProceed).toBe("NO");
    expect(result.verificationChecklist.length).toBeGreaterThan(1);
    expect(result.incidentReportSummary).toContain("상담/신고용 요약");
    expect(result.familyShareMessage).toContain("하위 호환");
  });

  it("이미 링크를 누른 사용자에게 사후 조치를 직접 답한다", () => {
    const result = analyzeMessageRiskTool({
      message: "택배 주소 오류라 해서 http://delivery-check-kr.example.com 링크를 눌렀는데 개인정보는 아직 입력 안 했어.",
      userQuestion: "이미 링크 눌렀어. 어떻게 해?",
      userSituation: "clicked_link",
    });

    expect(result.canProceed).toBe("NO");
    expect(result.userQuestionAnswer).toContain("이미 링크를 눌렀다면");
    expect(result.userQuestionAnswer).toContain("개인정보 입력과 파일 다운로드를 중단");
  });
});
