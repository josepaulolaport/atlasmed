import type { Territory, TerritoryApprovalRequest } from "@/types/territory";

export function isApprovalRequest(
  result: Territory | TerritoryApprovalRequest
): result is TerritoryApprovalRequest {
  return "requesterId" in result && !("code" in result);
}
