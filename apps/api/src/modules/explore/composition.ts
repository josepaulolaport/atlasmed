import { McpTestRepository } from "./infrastructure/repositories/mcp-test.repository";
import { ExploreUseCases } from "./application/use-cases/explore.use-cases";

const repository = new McpTestRepository();
const exploreUseCases = new ExploreUseCases(repository);

export { exploreUseCases };
