export { environment, type Environment } from "@atlasmed/config";

import { environment } from "@atlasmed/config";

export const isDevelopment = () => environment.NODE_ENV === "development";
export const isProduction = () => environment.NODE_ENV === "production";
export const isTest = () => environment.NODE_ENV === "test";
