export interface WorkflowInput {
  ingestionRunId: string;
  ano?: number;
  mes?: number;
}

export interface WorkflowResult {
  ingestionRunId: string;
  workflowId: string;
  reference: { ano: number; mes: number };
  stats: Record<string, unknown>;
}
