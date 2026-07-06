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
});
