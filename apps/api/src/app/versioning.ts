/**
 * API Versioning
 * 
 * Provides version management for the API.
 * Current version: v1
 */

import { Elysia } from "elysia";

export const API_VERSION = 'v1';

/**
 * Get the current API version
 */
export function getApiVersion(): string {
  return API_VERSION;
}

/**
 * Check if a version is supported
 */
export function isVersionSupported(version: string): boolean {
  return version === API_VERSION;
}

/**
 * Get the API version prefix path
 */
export function getApiPath(): string {
  return `/api/${API_VERSION}`;
}
