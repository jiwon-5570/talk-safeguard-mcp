import { describe, expect, it } from "vitest";
import { checkPhishingUrlTool } from "../mcp/tools/checkPhishingUrl.js";

describe("check_phishing_url", () => {
  it("hxxp URL을 정규화하고 샘플 URL을 탐지한다", () => {
    const result = checkPhishingUrlTool({ url: "hxxp://delivery-check-kr.example.com" });
    expect(result.normalizedUrl).toBe("http://delivery-check-kr.example.com/");
    expect(result.matchedKnownPattern).toBe(true);
    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.matchedDataSource).toContain("한국인터넷진흥원");
    expect(result.domain).toBe("delivery-check-kr.example.com");
    expect(result.riskScore).toBeGreaterThanOrEqual(85);
  });

  it("공식 서비스와 유사한 비공식 도메인을 탐지한다", () => {
    const result = checkPhishingUrlTool({ url: "https://kakao-login-security.example.org" });
    expect(result.riskLevel).not.toBe("LOW");
    expect(result.suspiciousSignals.join(" ")).toContain("공식 도메인");
  });

  it("카카오페이 이벤트 유사 도메인을 HIGH 이상으로 판단한다", () => {
    const result = checkPhishingUrlTool({ url: "http://kakao-pay-event.example.com/verify" });
    expect(["HIGH", "CRITICAL"]).toContain(result.riskLevel);
    expect(result.matchedKnownPattern).toBe(true);
    expect(result.matchedDataSource).toBe("sample-spam-url-patterns");
    expect(result.suspiciousSignals.join(" ")).toMatch(/카카오|브랜드|이벤트/);
  });

  it("카카오 공식 도메인의 일반 이벤트 경로를 과도하게 경고하지 않는다", () => {
    const result = checkPhishingUrlTool({ url: "https://www.kakao.com/event" });
    expect(result.riskLevel).toBe("LOW");
    expect(result.riskScore).toBe(0);
  });

  it.each([
    "https://bit.ly/example",
    "http://192.168.10.20/login",
    "https://xn--kakao-9za.example/verify",
    "hxxps://gov24-check.example.com/pay",
  ])("단축·IP·punycode·변형 URL 신호를 반환한다: %s", (url) => {
    const result = checkPhishingUrlTool({ url });
    expect(result.riskScore).toBeGreaterThan(0);
    expect(result.matchedDataSource.length).toBeGreaterThan(0);
    expect(result.suspiciousSignals.length).toBeGreaterThan(0);
  });
});
