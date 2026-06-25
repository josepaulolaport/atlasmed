"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import { setAccessToken, getAccessToken } from "@/lib/api/client";
import { isRefreshTokenReuseError } from "@/lib/api/errors";
import { isPublicAuthPath } from "@/lib/auth-routes";
import type { User, LoginRequest, RegisterRequest, UpdateProfileRequest } from "@/types/auth";
import { toast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  complete2FALogin: (data: { pendingToken: string; code: string }) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isPublicAuth = isPublicAuthPath(pathname);
  const [bootstrappedPath, setBootstrappedPath] = useState<string | null>(null);
  const loading = !isPublicAuth && bootstrappedPath !== pathname;

  useEffect(() => {
    if (isPublicAuth) {
      return;
    }

    let mounted = true;

    async function bootstrapSession() {
      try {
        if (!getAccessToken()) {
          const refreshed = await authApi.refreshToken();
          if (!mounted) return;
          setAccessToken(refreshed.session.token);
          setUser(refreshed.user);
          return;
        }

        const userData = await authApi.getProfile();
        if (!mounted) return;
        setUser(userData);
      } catch (error) {
        if (!mounted) return;

        if (!getAccessToken()) {
          setAccessToken(null);
          setUser(null);

          if (
            isRefreshTokenReuseError(error) &&
            typeof window !== "undefined" &&
            !isPublicAuthPath(pathname)
          ) {
            router.replace("/login?reason=refresh_reuse");
          }
        }
      } finally {
        if (mounted) {
          setBootstrappedPath(pathname);
        }
      }
    }

    void bootstrapSession();

    return () => {
      mounted = false;
    };
  }, [isPublicAuth, pathname, router]);

  const login = async (data: LoginRequest) => {
    try {
      const response = await authApi.login(data);

      if ("requires2FA" in response && response.requires2FA && response.pendingToken) {
        router.push(`/login/2fa?pending=${encodeURIComponent(response.pendingToken)}`);
        return;
      }

      if (!response.session?.token || !response.user) {
        throw new Error("Invalid login response");
      }

      setAccessToken(response.session.token);
      setUser(response.user);
      setBootstrappedPath("/dashboard");

      toast({
        title: "Success",
        description: "Logged in successfully",
        variant: "success",
      });

      router.push("/dashboard");
    } catch (err) {
      const error = err as { response?: { data?: { error?: { message?: string; code?: string } } } };
      const message = error.response?.data?.error?.message || "Invalid credentials";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const complete2FALogin = async (data: { pendingToken: string; code: string }) => {
    const response = await authApi.verify2FALogin(data);

    if (!response.session?.token || !response.user) {
      throw new Error("Invalid verification response");
    }

    setAccessToken(response.session.token);
    setUser(response.user);
    setBootstrappedPath("/dashboard");

    toast({
      title: "Success",
      description: "Logged in successfully",
      variant: "success",
    });

    router.push("/dashboard");
  };

  const register = async (data: RegisterRequest) => {
    try {
      await authApi.register(data);

      toast({
        title: "Success",
        description: "Registration successful. Please sign in.",
        variant: "success",
      });

      router.push("/login");
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      const message = error.response?.data?.error || "Registration failed";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
      router.push("/login");
    }
  };

  const updateProfile = async (data: UpdateProfileRequest) => {
    try {
      const updatedUser = await authApi.updateProfile(data);
      setUser(updatedUser);

      toast({
        title: "Success",
        description: "Profile updated successfully",
        variant: "success",
      });
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      const message = error.response?.data?.error || "Failed to update profile";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await authApi.getProfile();
      setUser(userData);
    } catch {
      // Silently fail refresh
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    complete2FALogin,
    register,
    logout,
    updateProfile,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
