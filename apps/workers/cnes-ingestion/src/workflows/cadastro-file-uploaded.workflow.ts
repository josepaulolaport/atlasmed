import { proxyActivities } from "@temporalio/workflow";
import type { CadastroFileUploadedInput } from "../activities/cadastro-file-processing.activities";

const activities = proxyActivities<typeof import("../activities/index")>({
  startToCloseTimeout: "15 minutes",
  retry: { maximumAttempts: 3 },
});

export async function cadastroFileUploadedWorkflow(
  input: CadastroFileUploadedInput
): Promise<{ fileAssetId: string; status: "READY" | "FAILED" }> {
  return activities.processCadastroFileUploadedActivity(input);
}
