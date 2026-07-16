import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyBusinessRegistration } from "../services/businessRegistryService.js";
import { verifyOnlineSellerRegistration } from "../services/onlineSellerService.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("공공 API 응답 안전 처리", () => {
  it("국세청 HTTP 200 오류를 정상 사업자로 오인하지 않는다", async () => {
    vi.stubEnv("NTS_BUSINESS_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status_code: "ERROR",
      data: [],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const result = await verifyBusinessRegistration("123-45-67890");
    expect(result.status).toBe("UNKNOWN");
    expect(result.canTrustSeller).toBe("CHECK_FIRST");
    expect(result.warnings.join(" ")).toContain("NTS_API_ERROR");
  });

  it("대표자명과 개업일자를 국세청 진위확인 API에 실제로 전달한다", async () => {
    vi.stubEnv("NTS_BUSINESS_API_KEY", "test-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status_code: "OK",
        data: [{ b_stt_cd: "01", b_stt: "계속사업자" }],
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status_code: "OK",
        data: [{ valid: "01", valid_msg: "확인되었습니다." }],
      }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyBusinessRegistration("123-45-67890", "홍길동", "20200101");
    expect(result.status).toBe("ACTIVE");
    expect(result.authenticity).toBe("MATCH");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const validationRequest = fetchMock.mock.calls[1];
    expect(String(validationRequest?.[0])).toContain("/validate");
    expect(String((validationRequest?.[1] as RequestInit | undefined)?.body)).toContain('"p_nm":"홍길동"');
  });

  it("공정위 HTTP 200 오류를 미등록 판매자로 오인하지 않는다", async () => {
    vi.stubEnv("FTC_ONLINE_SELLER_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      response: { header: { resultCode: "30", resultMsg: "SERVICE_KEY_IS_NOT_REGISTERED_ERROR" } },
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const result = await verifyOnlineSellerRegistration("123-45-67890");
    expect(result.registered).toBeNull();
    expect(result.canProceedWithPurchase).toBe("CHECK_FIRST");
    expect(result.warnings.join(" ")).toContain("FTC_API_30");
  });

  it("공정위 정상 응답의 조회 결과 없음만 미등록으로 처리한다", async () => {
    vi.stubEnv("FTC_ONLINE_SELLER_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      response: { header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" }, body: { items: [] } },
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const result = await verifyOnlineSellerRegistration("123-45-67890");
    expect(result.registered).toBe(false);
    expect(result.status).toBe("등록 정보 없음");
    expect(result.warnings.join(" ")).toContain("등록상세 결과가 없습니다");
  });

  it("공정위 조회 결과의 판매자 대조 정보를 반환한다", async () => {
    vi.stubEnv("FTC_ONLINE_SELLER_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      response: {
        header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" },
        body: { items: [{
          brno: "1234567890",
          bzmnNm: "주식회사 안전상점",
          rprsvNm: "김대표",
          operSttusCdNm: "정상영업",
          prmmiMnno: "2026-서울-0001",
          lctnRnAddr: "서울특별시 중구 테스트로 1",
          lntrnetDomainNm: "safe-shop.example",
        }] },
      },
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const result = await verifyOnlineSellerRegistration("123-45-67890", "(주)안전상점");
    expect(result.registered).toBe(true);
    expect(result.identityMatched).toBe(true);
    expect(result.sellerDetails?.companyName).toBe("주식회사 안전상점");
    expect(result.sellerDetails?.representativeName).toBe("김대표");
    expect(result.sellerDetails?.permitNumber).toBe("2026-서울-0001");
  });
});
