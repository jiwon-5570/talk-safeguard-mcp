import { classifyMessage } from "../../services/riskRuleEngine.js";
import { withSafety } from "../responses.js";
import { MessageInputSchema } from "../schemas.js";

export function classifyScamTypeTool(input: unknown) {
  const { message } = MessageInputSchema.parse(input);
  return withSafety(classifyMessage(message));
}
