export interface ApiError {
  message: string;
  code?: string;
  field?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface VerificationRequest {
  email?: string;
  phoneNumber?: string;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    database: {
      status: "healthy" | "degraded" | "unhealthy";
      responseTime?: number;
    };
    redis: {
      status: "healthy" | "degraded" | "unhealthy";
      responseTime?: number;
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  metrics?: {
    activeUsers: number;
    activeSessions: number;
    loginSuccessRate: number;
    passwordResets: number;
  };
}

export interface VerificationRequest {
  email?: string;
  phoneNumber?: string;
}

export interface VerificationConfirm {
  token?: string;
  code?: string;
}

export interface ChangeEmailRequest {
  newEmail: string;
  password: string;
}

export interface ChangePhoneRequest {
  newPhoneNumber: string;
  password: string;
}
