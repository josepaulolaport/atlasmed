/**
 * Shared API contracts between backend and frontend
 * 
 * These types ensure type safety across the full stack.
 * Keep this minimal - only include shared interfaces and types.
 */

// Example User types
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
}

// Example API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Add your specific AtlasMed types here as you develop
