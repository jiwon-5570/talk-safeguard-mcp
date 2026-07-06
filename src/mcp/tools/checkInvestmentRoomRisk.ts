import { analyzeInvestmentRoomRisk } from "../../services/investmentRiskService.js";
import { withSafety } from "../responses.js";
import { MessageInputSchema } from "../schemas.js";

export function checkInvestmentRoomRiskTool(input: unknown) {
  const { message } = MessageInputSchema.parse(input);
  return withSafety(analyzeInvestmentRoomRisk(message));
}
