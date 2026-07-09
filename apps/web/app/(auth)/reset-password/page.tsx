"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { passwordResetSchema } from "@/lib/validators";
import { authApi } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PasswordResetConfirm } from "@/types/auth";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PasswordResetConfirm>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      token,
    },
  });

  const password = watch("password");

  const passwordRequirements = [
    { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
    { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
    { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
    { label: "One number", test: (p: string) => /[0-9]/.test(p) },
    {
      label: "One special character",
      test: (p: string) => /[^A-Za-z0-9]/.test(p),
    },
  ];

  const onSubmit = async (data: PasswordResetConfirm) => {
    setIsLoading(true);
    setError(null);

    try {
      await authApi.resetPassword(data);
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(
        error.response?.data?.message ||
          "Failed to reset password. The link may be expired."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-xl font-semibold tracking-tighter text-zinc-900">
              ATLASMED
            </h1>
            <p className="text-sm text-zinc-500 mt-2">
              Healthcare Commercial Operations
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-6">
            <h2 className="text-lg font-medium text-red-600">
              Invalid reset link
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              The password reset link is missing or invalid.
            </p>
            <div className="mt-6">
              <Link href="/forgot-password" className="block">
                <Button variant="primary" className="w-full">
                  Request new reset link
                </Button>
              </Link>
            </div>
          </div>
          <p className="text-center text-xs text-zinc-500 mt-6">
            &copy; AtlasMed 2026
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-xl font-semibold tracking-tighter text-zinc-900">
              ATLASMED
            </h1>
            <p className="text-sm text-zinc-500 mt-2">
              Healthcare Commercial Operations
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <iconify-icon
                icon="solar:check-circle-linear"
                stroke-width="1.5"
                className="text-2xl"
              />
            </div>
            <h2 className="text-lg font-medium text-zinc-900">
              Password reset successful
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              Your password has been reset. Redirecting to login...
            </p>
          </div>
          <p className="text-center text-xs text-zinc-500 mt-6">
            &copy; AtlasMed 2026
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold tracking-tighter text-zinc-900">
            ATLASMED
          </h1>
          <p className="text-sm text-zinc-500 mt-2">
            Healthcare Commercial Operations
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-6">
          <h2 className="text-lg font-medium text-zinc-900">
            Reset your password
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            Enter your new password below.
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-100 p-3 text-sm text-red-600">
                <iconify-icon
                  icon="solar:danger-circle-linear"
                  stroke-width="1.5"
                  className="text-base mt-0.5"
                />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your new password"
                {...register("password")}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password.message}</p>
              )}

              {password && (
                <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs font-medium text-zinc-700">
                    Password requirements
                  </p>
                  <ul className="space-y-1">
                    {passwordRequirements.map((req, index) => {
                      const passed = req.test(password);
                      return (
                        <li
                          key={index}
                          className="flex items-center gap-2 text-xs"
                        >
                          <iconify-icon
                            icon={
                              passed
                                ? "solar:check-circle-linear"
                                : "solar:close-circle-linear"
                            }
                            stroke-width="1.5"
                            className={
                              passed
                                ? "text-sm text-emerald-600"
                                : "text-sm text-zinc-400"
                            }
                          />
                          <span
                            className={
                              passed ? "text-emerald-700" : "text-zinc-500"
                            }
                          >
                            {req.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Resetting password..." : "Reset password"}
            </Button>

            <Link href="/login" className="block">
              <Button variant="ghost" className="w-full">
                Back to sign in
              </Button>
            </Link>
          </form>
        </div>
        <p className="text-center text-xs text-zinc-500 mt-6">
          &copy; AtlasMed 2026
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-50">
          <div className="py-10 text-center text-sm text-zinc-500">
            Loading...
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
