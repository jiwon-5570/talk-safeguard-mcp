import { describe, expect, it } from "vitest";
import { checkPhishingUrlTool } from "../mcp/tools/checkPhishingUrl.js";

describe("check_phishing_url", () => {
  it("hxxp URL을 정규화하고 샘플 URL을 탐지한다", () => {
    const result = checkPhishingUrlTool({ url: "hxxp://delivery-check-kr.example.com" });
    expect(result.normalizedUrl).toBe("http://delivery-check-kr.example.com/");
    expect(result.matchedKnownPattern).toBe(true);
    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.matchedDataSource).toContain("한국인터넷진흥원");
  });

  it("공식 서비스와 유사한 비공식 도메인을 탐지한다", () => {
    const result = checkPhishingUrlTool({ url: "https://kakao-login-security.example.org" });
    expect(result.riskLevel).not.toBe("LOW");
    expect(result.suspiciousSignals.join(" ")).toContain("공식 도메인");
  });
});
