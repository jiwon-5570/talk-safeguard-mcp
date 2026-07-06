import { verifyOnlineSellerRegistration } from "../../services/onlineSellerService.js";
import { withSafety } from "../responses.js";
import { VerifyOnlineSellerInputSchema } from "../schemas.js";

export async function verifyOnlineSellerTool(input: unknown) {
  const value = VerifyOnlineSellerInputSchema.parse(input);
  const result = await verifyOnlineSellerRegistration(value.businessRegistrationNumber, value.companyName);
  return withSafety(result);
}
