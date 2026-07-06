import { generateSafetyGuide } from "../../services/safetyGuideService.js";
import { withSafety } from "../responses.js";
import { SafeActionGuideInputSchema } from "../schemas.js";

export function generateSafeActionGuideTool(input: unknown) {
  const { userSituation, riskLevel, scamType } = SafeActionGuideInputSchema.parse(input);
  const guide = generateSafetyGuide(userSituation, riskLevel, scamType);
  return withSafety(guide, guide.safetyMessage);
}
