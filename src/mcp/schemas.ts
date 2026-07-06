import { z } from "zod";

export const RiskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const UserSituationSchema = z.enum([
  "before_click",
  "clicked_link",
  "sent_money",
  "installed_app",
  "shared_info",
  "unknown",
]);
export type UserSituation = z.infer<typeof UserSituationSchema>;

export const ReceivedViaSchema = z.enum(["kakao", "open_chat", "group_chat", "direct_chat", "unknown"]);
export type ReceivedVia = z.infer<typeof ReceivedViaSchema>;

export const ScamTypeSchema = z.enum([
  "FAMILY_IMPERSONATION",
  "AGENCY_IMPERSONATION",
  "KAKAO_BRAND_IMPERSONATION",
  "DELIVERY_SMISHING",
  "INVITATION_SMISHING",
  "PUBLIC_NOTICE_SMISHING",
  "LOAN_SCAM",
  "INVESTMENT_ROOM",
  "SHOPPING_PREPAYMENT",
  "USED_MARKET_PREPAYMENT",
  "GIFT_CARD_SCAM",
  "ACCOUNT_TAKEOVER",
  "AUTH_CODE_REQUEST",
  "REMOTE_APP_INSTALL",
  "UNKNOWN_RISK",
]);
export type ScamType = z.infer<typeof ScamTypeSchema>;

export const MessageInputSchema = z.object({
  message: z.string().trim().min(1).max(20_000).describe("분석할 카카오톡 메시지 원문"),
});

export const AnalyzeMessageInputSchema = MessageInputSchema.extend({
  userSituation: UserSituationSchema.optional().default("unknown"),
  receivedVia: ReceivedViaSchema.optional().default("unknown"),
});

export const CheckUrlInputSchema = z.object({
  url: z.string().trim().min(1).max(2_048),
});

export const VerifyBusinessInputSchema = z.object({
  businessRegistrationNumber: z.string().trim().min(1).max(32),
  representativeName: z.string().trim().min(1).max(100).optional(),
  startDate: z.string().trim().regex(/^\d{8}$/, "개업일자는 YYYYMMDD 형식이어야 합니다.").optional(),
});

export const VerifyOnlineSellerInputSchema = z
  .object({
    businessRegistrationNumber: z.string().trim().min(1).max(32).optional(),
    companyName: z.string().trim().min(1).max(200).optional(),
  })
  .refine((value) => value.businessRegistrationNumber !== undefined || value.companyName !== undefined, {
    message: "사업자등록번호 또는 상호명 중 하나는 필요합니다.",
  });

export const SafeActionGuideInputSchema = z.object({
  userSituation: UserSituationSchema,
  riskLevel: RiskLevelSchema,
  scamType: ScamTypeSchema.optional(),
});

export interface SafetyNotice {
  safetyMessage: string;
  disclaimer: string;
}
