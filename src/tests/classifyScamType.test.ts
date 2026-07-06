import { describe, expect, it } from "vitest";
import { classifyScamTypeTool } from "../mcp/tools/classifyScamType.js";

describe("classify_scam_type", () => {
  it.each([
    ["엄마 나 폰 고장났어. 이 계좌로 보내줘.", "FAMILY_IMPERSONATION"],
    ["서울중앙지검입니다. 범죄 수사 중이니 보안 앱 설치 후 본인인증하세요.", "AGENCY_IMPERSONATION"],
    ["택배 주소 오류입니다. http://delivery-check-kr.example.com 에서 입력하세요.", "DELIVERY_SMISHING"],
    ["VIP 리딩방 원금 보장, 해외거래소 가입 시 매일 수익", "INVESTMENT_ROOM"],
    ["카톡 주문만 가능, 개인계좌로 입금하면 배송", "SHOPPING_PREPAYMENT"],
  ])("%s => %s", (message, expected) => {
    const result = classifyScamTypeTool({ message });
    expect([result.primaryType, ...result.subTypes]).toContain(expected);
    expect(result.disclaimer).toContain("확정 판정이 아닙니다");
  });
});
