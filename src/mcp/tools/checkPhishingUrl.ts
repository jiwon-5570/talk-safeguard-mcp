import { analyzePhishingUrl } from "../../services/phishingUrlService.js";
import { withSafety } from "../responses.js";
import { CheckUrlInputSchema } from "../schemas.js";

export function checkPhishingUrlTool(input: unknown) {
  const { url } = CheckUrlInputSchema.parse(input);
  return withSafety(analyzePhishingUrl(url));
}
