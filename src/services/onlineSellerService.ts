import { normalizeBusinessNumber } from "./businessRegistryService.js";

export interface OnlineSellerVerification {
  registered: boolean | null;
  status: string;
  source: string;
  warnings: string[];
  safeAction: string;
}

interface UnknownRecord {
  [key: string]: unknown;
}

const sampleSellers = [
  { businessNumber: "1234567890", companyName: "톡세이프 데모상점", status: "정상영업" },
  { businessNumber: "1111111111", companyName: "휴업 데모상점", status: "휴업" },
];

function fallback(businessNumber?: string, companyName?: string, fallbackWarning?: string): OnlineSellerVerification {
  const normalized = businessNumber === undefined ? undefined : normalizeBusinessNumber(businessNumber);
  const match = sampleSellers.find(
    (seller) => seller.businessNumber === normalized || (companyName !== undefined && seller.companyName.includes(companyName)),
  );
  return {
    registered: match === undefined ? null : true,
    status: match?.status ?? "샘플에서 확인되지 않음",
    source: "공정거래위원회 통신판매사업자 데이터 형식 기반 sample fallback",
    warnings: [
      ...(fallbackWarning === undefined ? [] : [fallbackWarning]),
      "현재 결과는 공모전 시연용 로컬 샘플이며 실시간 등록 조회 결과가 아닙니다.",
      "통신판매업 등록이 확인되어도 거래 위험 가능성이 0이 되거나 거래 안전이 보장되는 것은 아닙니다.",
    ],
    safeAction: "공정거래위원회 공식 조회 화면에서 상호·대표자·주소를 교차 확인하고 안전결제를 사용하세요.",
  };
}

function findItems(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter((item): item is UnknownRecord => typeof item === "object" && item !== null);
  if (typeof value !== "object" || value === null) return [];
  const record = value as UnknownRecord;
  for (const key of ["items", "item", "data"]) {
    const found = findItems(record[key]);
    if (found.length > 0) return found;
  }
  for (const nested of Object.values(record)) {
    const found = findItems(nested);
    if (found.length > 0) return found;
  }
  return [];
}

export async function verifyOnlineSellerRegistration(
  businessRegistrationNumber?: string,
  companyName?: string,
): Promise<OnlineSellerVerification> {
  const apiKey = process.env.FTC_ONLINE_SELLER_API_KEY?.trim();
  const actualMode = process.env.PUBLIC_DATA_MODE?.trim().toLowerCase() === "actual";
  if (!actualMode || !apiKey) {
    return fallback(
      businessRegistrationNumber,
      companyName,
      actualMode && !apiKey
        ? "PUBLIC_DATA_MODE=actual이지만 공정거래위원회 API 키가 없어 sample fallback을 사용합니다."
        : undefined,
    );
  }

  try {
    const byBusinessNumber = businessRegistrationNumber !== undefined;
    const operation = byBusinessNumber ? "getMllBsBiznoInfo_2" : "getMllBsCoNmInfo_2";
    const endpoint = new URL(`https://apis.data.go.kr/1130000/MllBs_2Service/${operation}`);
    endpoint.searchParams.set("serviceKey", apiKey);
    endpoint.searchParams.set("pageNo", "1");
    endpoint.searchParams.set("numOfRows", "10");
    endpoint.searchParams.set("resultType", "json");
    if (businessRegistrationNumber !== undefined) {
      endpoint.searchParams.set("brno", normalizeBusinessNumber(businessRegistrationNumber));
    }
    if (companyName !== undefined) endpoint.searchParams.set("corpNm", companyName);

    const response = await fetch(endpoint, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(7_000) });
    if (!response.ok) throw new Error(`FTC_HTTP_${response.status}`);
    const items = findItems(await response.json());
    const first = items[0];
    const status = String(first?.["operSttusNm"] ?? first?.["status"] ?? (items.length > 0 ? "등록 확인" : "등록 정보 없음"));
    return {
      registered: items.length > 0,
      status,
      source: "공정거래위원회 통신판매사업자 등록현황 제공 서비스",
      warnings: ["통신판매업 등록이 확인되어도 거래 위험 가능성이 0이 되거나 거래 안전이 보장되는 것은 아닙니다."],
      safeAction: "조회된 상호·대표자·주소가 판매자가 제시한 정보와 같은지 확인하고 안전결제를 사용하세요.",
    };
  } catch {
    return fallback(
      businessRegistrationNumber,
      companyName,
      "공정거래위원회 API 호출에 실패하여 로컬 샘플로 대체했습니다.",
    );
  }
}
