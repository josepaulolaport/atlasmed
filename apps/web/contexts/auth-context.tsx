"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import type { User, LoginRequest, RegisterRequest, UpdateProfileRequest } from "@/types/auth";
import { toast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadUser = useCallback(async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        setLoading(false);
        return;
      }

      const userData = await authApi.getProfile();
      setUser(userData);
    } catch {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (data: LoginRequest) => {
    try {
      const response = await authApi.login(data);
      
      localStorage.setItem("accessToken", response.session.token);
      localStorage.setItem("user", JSON.stringify(response.user));
      
      setUser(response.user);

      toast({
        title: "Success",
        description: "Logged in successfully",
        variant: "success",
      });

      router.push("/dashboard");
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      const message = error.response?.data?.error || "Invalid credentials";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      throw error;
    }
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
      // Backend gets the current session from auth context
      await authApi.logout();

      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      
      setUser(null);

      toast({
        title: "Success",
        description: "Logged out successfully",
      });

      router.push("/login");
    } catch (error) {
      // Even if API call fails, clear local state
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      
      setUser(null);
      router.push("/login");
    }
  };

  const updateProfile = async (data: UpdateProfileRequest) => {
    try {
      const updatedUser = await authApi.updateProfile(data);
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));

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
      localStorage.setItem("user", JSON.stringify(userData));
    } catch {
      // Silently fail refresh
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
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
