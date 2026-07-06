import { verifyBusinessRegistration } from "../../services/businessRegistryService.js";
import { withSafety } from "../responses.js";
import { VerifyBusinessInputSchema } from "../schemas.js";

export async function verifyBusinessInfoTool(input: unknown) {
  const value = VerifyBusinessInputSchema.parse(input);
  const result = await verifyBusinessRegistration(
    value.businessRegistrationNumber,
    value.representativeName,
    value.startDate,
  );
  return withSafety(result);
}
