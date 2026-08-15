import { DrizzleRoteiroRepository } from "./infrastructure/repositories/drizzle-roteiro.repository";
import { GenerateRoteiroUseCase } from "./application/use-cases/generate-roteiro.use-case";

const repository = new DrizzleRoteiroRepository();

export const roteiroUseCases = {
  generate: () => new GenerateRoteiroUseCase({ repository }),
};
