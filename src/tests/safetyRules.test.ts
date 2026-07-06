import { describe, expect, it, vi } from "vitest";
import { analyzeMessageRiskTool } from "../mcp/tools/analyzeMessageRisk.js";
import { checkInvestmentRoomRiskTool } from "../mcp/tools/checkInvestmentRoomRisk.js";
import { checkPhishingUrlTool } from "../mcp/tools/checkPhishingUrl.js";
import { classifyScamTypeTool } from "../mcp/tools/classifyScamType.js";
import { extractRiskIndicatorsTool } from "../mcp/tools/extractRiskIndicators.js";
import { generateSafeActionGuideTool } from "../mcp/tools/generateSafeActionGuide.js";
import { verifyBusinessInfoTool } from "../mcp/tools/verifyBusinessInfo.js";
import { verifyOnlineSellerTool } from "../mcp/tools/verifyOnlineSeller.js";

const bannedClaims = [
  "이건 사기입니다.",
  "이 사람은 사기꾼입니다.",
  "이 계좌는 범죄 계좌입니다.",
  "무조건 안전합니다.",
  "신고하지 않아도 됩니다.",
];

describe("안전 표현 및 개인정보 원칙", () => {
  it("8개 도구 응답 모두 안전 고지와 면책 고지를 포함한다", async () => {
    vi.stubEnv("NTS_BUSINESS_API_KEY", "");
    vi.stubEnv("FTC_ONLINE_SELLER_API_KEY", "");
    const message = "엄마 급하게 이 계좌로 보내줘. 전화는 안 돼.";
    const outputs = [
      analyzeMessageRiskTool({ message }),
      extractRiskIndicatorsTool({ message }),
      checkPhishingUrlTool({ url: "https://example.com" }),
      classifyScamTypeTool({ message }),
      await verifyBusinessInfoTool({ businessRegistrationNumber: "123-45-67890" }),
      await verifyOnlineSellerTool({ businessRegistrationNumber: "123-45-67890" }),
      checkInvestmentRoomRiskTool({ message: "VIP 리딩방 원금 보장" }),
      generateSafeActionGuideTool({ userSituation: "sent_money", riskLevel: "CRITICAL" }),
    ];

    expect(outputs).toHaveLength(8);
    for (const output of outputs) {
      expect(output.safetyMessage.length).toBeGreaterThan(10);
      expect(output.disclaimer).toContain("보조 판단");
      const serialized = JSON.stringify(output);
      for (const claim of bannedClaims) expect(serialized).not.toContain(claim);
    }
    vi.unstubAllEnvs();
  });

  it("민감정보를 추출하되 로그나 저장소 없이 호출 결과에만 반환한다", () => {
    const result = extractRiskIndicatorsTool({
      message: "연락처 010-1234-5678, 계좌 123-456-789012, 사업자번호 123-45-67890",
    });
    expect(result.phoneNumbers).toContain("010-1234-5678");
    expect(result.bankAccountCandidates).toContain("123-456-789012");
    expect(result.businessRegistrationNumbers).toContain("1234567890");
  });

  it("핵심 판단 필드와 개인정보 비저장 신고 요약을 만든다", () => {
    const result = analyzeMessageRiskTool({
      message: "엄마 나 폰 고장났어. 구글 기프트카드 사서 핀번호 사진 보내줘. 전화는 안 돼.",
      userSituation: "before_click",
      receivedVia: "direct_chat",
    });

    expect(result.decisionSummary).toContain("위험");
    expect(result.verdict).toBe("HIGHLY_SUSPICIOUS");
    expect(result.canProceed).toBe("NO");
    expect(result.verificationChecklist.join(" ")).toMatch(/가족|지인/);
    expect(result.nextStepGuide.join(" ")).toMatch(/상품권|핀번호/);
    expect(result.incidentReportSummary).toContain("받은 경로: 개인톡");
    expect(result.incidentReportSummary).toContain("원문을 저장하지 않음");
    expect(result.incidentReportSummary).toContain("송금 요구");
    expect(result.familyShareMessage).toContain("하위 호환");
  });
});
