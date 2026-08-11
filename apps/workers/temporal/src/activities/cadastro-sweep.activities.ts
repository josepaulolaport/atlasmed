import {
  sweepCadastroUploads,
  type CadastroSweepReport,
} from "../cadastro/sweep-cadastro-uploads";

export async function sweepCadastroUploadsActivity(): Promise<CadastroSweepReport> {
  return sweepCadastroUploads();
}
