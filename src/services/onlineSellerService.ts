import type { CanProceed } from "../mcp/schemas.js";
import { normalizeBusinessNumber } from "./businessRegistryService.js";

interface OnlineSellerVerificationBase {
  registered: boolean | null;
  status: string;
  source: string;
  warnings: string[];
  safeAction: string;
}

export interface OnlineSellerVerification extends OnlineSellerVerificationBase {
  sellerDecision: string;
  canProceedWithPurchase: CanProceed;
  remainingRisks: string[];
  safePurchaseChecklist: string[];
}

interface UnknownRecord {
  [key: string]: unknown;
}

function withSellerDecision(value: OnlineSellerVerificationBase): OnlineSellerVerification {
  const inactive = /휴업|폐업|취소|말소|영업정지|정지/u.test(value.status);
  return {
    ...value,
    sellerDecision: inactive
      ? "통신판매사업자 상태가 정상 영업으로 확인되지 않아 구매를 진행하지 않는 것이 안전합니다."
      : "통신판매사업자 등록 여부만으로 거래 안전을 보장할 수 없습니다. 판매자 정보와 결제 조건을 추가 확인하세요.",
    canProceedWithPurchase: inactive ? "NO" : "CHECK_FIRST",
    remainingRisks: [
      "통신판매업 등록이 확인되어도 판매자 신원과 거래 안전이 보장되지는 않습니다.",
      "개인계좌 선입금, 안전결제 거부, 지나치게 낮은 가격은 별도 위험 신호입니다.",
      "등록된 상호·대표자·주소와 실제 판매자 정보가 다를 수 있습니다.",
    ],
    safePurchaseChecklist: [
      "공정거래위원회 공식 조회 결과의 상호·대표자·주소를 판매자 표시 정보와 비교하세요.",
      "사업자등록번호와 입금 계좌 명의가 일치하는지 확인하세요.",
      "구매자 보호가 적용되는 플랫폼 안전결제를 사용하세요.",
      "카톡 주문만 가능하거나 외부 결제를 유도하면 결제를 중단하세요.",
    ],
  };
}

function actualUnavailable(warnings: string[]): OnlineSellerVerification {
  return withSellerDecision({
    registered: null,
    status: "실제 공정위 API 조회 실패",
    source: "공정거래위원회 통신판매사업자 등록상세 제공 서비스",
    warnings,
    safeAction: "실제 공정위 API 조회가 완료되지 않았습니다. API 키, 활용신청 상태, 조회 파라미터를 확인한 뒤 다시 조회하세요.",
  });
}

function looksLikeOnlineSellerItem(record: UnknownRecord): boolean {
  return ["brno", "bzmnNm", "operSttusCdNm", "prmmiMnno", "opnSn"].some((key) => record[key] !== undefined);
}

function findItems(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.flatMap((item) => findItems(item));
  if (typeof value !== "object" || value === null) return [];
  const record = value as UnknownRecord;
  if (looksLikeOnlineSellerItem(record)) return [record];
  for (const key of ["items", "item", "data", "response", "body"]) {
    const found = findItems(record[key]);
    if (found.length > 0) return found;
  }
  for (const nested of Object.values(record)) {
    const found = findItems(nested);
    if (found.length > 0) return found;
  }
  return [];
}

function decodeApiKey(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function stringifyStatus(value: unknown, defaultValue: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : defaultValue;
}

export async function verifyOnlineSellerRegistration(
  businessRegistrationNumber?: string,
  companyName?: string,
): Promise<OnlineSellerVerification> {
  const apiKey = process.env.FTC_ONLINE_SELLER_API_KEY?.trim();
  if (!apiKey) {
    return actualUnavailable(["FTC_ONLINE_SELLER_API_KEY가 설정되지 않아 실제 공정위 API 조회를 수행하지 못했습니다."]);
  }
  if (businessRegistrationNumber === undefined) {
    return actualUnavailable([
      "승인된 공정위 등록상세 API는 사업자등록번호(brno), 인허가관리번호(prmmiMnno), 개방일련번호(opnSn) 기준 조회입니다.",
      "현재 MCP 입력에는 상호명만 있어 실제 API 조회를 수행하지 않았습니다. 사업자등록번호를 함께 입력하세요.",
      ...(companyName === undefined ? [] : [`입력된 상호명: ${companyName}`]),
    ]);
  }

  const normalizedBusinessNumber = normalizeBusinessNumber(businessRegistrationNumber);
  if (normalizedBusinessNumber.length !== 10) {
    return actualUnavailable(["공정위 등록상세 API 조회에는 숫자 10자리 사업자등록번호가 필요합니다."]);
  }

  try {
    const endpoint = new URL("https://apis.data.go.kr/1130000/MllBsDtl_3Service/getMllBsInfoDetail_3");
    endpoint.searchParams.set("serviceKey", decodeApiKey(apiKey));
    endpoint.searchParams.set("pageNo", "1");
    endpoint.searchParams.set("numOfRows", "10");
    endpoint.searchParams.set("resultType", "json");
    endpoint.searchParams.set("brno", normalizedBusinessNumber);

    const response = await fetch(endpoint, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`FTC_HTTP_${response.status}`);
    const payload = await response.json();
    const items = findItems(payload);
    const first = items[0];
    const status = stringifyStatus(
      first?.["operSttusCdNm"] ?? first?.["bzmnRgsSttusSeNm"],
      items.length > 0 ? "등록 상세 정보 확인" : "등록 정보 없음",
    );
    return withSellerDecision({
      registered: items.length > 0,
      status,
      source: "공정거래위원회 통신판매사업자 등록상세 제공 서비스",
      warnings: [
        "통신판매업 등록이 확인되어도 거래 위험 가능성이 0이 되거나 거래 안전이 보장되는 것은 아닙니다.",
        ...(items.length === 0 ? ["입력한 사업자등록번호로 공정위 등록상세 결과가 없습니다."] : []),
      ],
      safeAction: "조회된 상호·대표자·주소가 판매자가 표시한 정보와 같은지 확인하고 안전결제를 사용하세요.",
    });
  } catch (error) {
    return actualUnavailable([
      `공정위 등록상세 API 호출에 실패했습니다: ${error instanceof Error ? error.message : "UNKNOWN_ERROR"}`,
      "API 실패 시 대체 데이터로 결과를 꾸미지 않습니다.",
    ]);
  }
}
