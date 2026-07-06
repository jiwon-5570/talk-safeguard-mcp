import { AnalyzeMessageInputSchema } from "../schemas.js";
import { INCIDENT_SAFETY_MESSAGE, withSafety } from "../responses.js";
import { analyzeMessage } from "../../services/riskRuleEngine.js";

export function analyzeMessageRiskTool(input: unknown) {
  const { message, userSituation, receivedVia } = AnalyzeMessageInputSchema.parse(input);
  const result = analyzeMessage(message, userSituation, receivedVia);
  const incident = ["sent_money", "installed_app", "shared_info"].includes(userSituation);
  return withSafety(result, incident ? INCIDENT_SAFETY_MESSAGE : undefined);
}
