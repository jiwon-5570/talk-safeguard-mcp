import { extractRiskIndicators } from "../../utils/extractors.js";
import { processEphemeral } from "../../utils/privacy.js";
import { withSafety } from "../responses.js";
import { MessageInputSchema } from "../schemas.js";

export function extractRiskIndicatorsTool(input: unknown) {
  const { message } = MessageInputSchema.parse(input);
  const result = processEphemeral(message, extractRiskIndicators);
  return withSafety(result);
}
