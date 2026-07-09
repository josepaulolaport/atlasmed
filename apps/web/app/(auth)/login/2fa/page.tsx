"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/auth-context";
import { totpCodeSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";

const verify2FASchema = z.object({
  code: totpCodeSchema,
});

type Verify2FAForm = z.infer<typeof verify2FASchema>;

export default function Verify2FALoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-50">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <Verify2FALoginInner />
    </Suspense>
  );
}

function Verify2FALoginInner() {
  const searchParams = useSearchParams();
  const pendingToken = searchParams.get("pending");
  const { complete2FALogin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Verify2FAForm>({
    resolver: zodResolver(verify2FASchema),
  });

  const onSubmit = async (data: Verify2FAForm) => {
    if (!pendingToken) {
      setError("Missing verification session. Please sign in again.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await complete2FALogin({ pendingToken, code: data.code });
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: string } } };
      const message =
        apiError.response?.data?.error ||
        "Invalid verification code. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!pendingToken) {
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
            <h2 className="text-lg font-medium text-zinc-900">
              Verification session expired
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              Start over from the sign-in page to continue.
            </p>
            <div className="mt-6">
              <Link
                href="/login"
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                Back to sign in
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
            Two-factor authentication
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            Enter the 6-digit code from your authenticator app
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
              <Label htmlFor="code">Authentication code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                {...register("code")}
                disabled={isLoading}
              />
              {errors.code && (
                <p className="text-xs text-red-600">{errors.code.message}</p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Verifying..." : "Verify and sign in"}
            </Button>

            <Link
              href="/login"
              className="block text-center text-sm text-blue-600 hover:underline font-medium"
            >
              Back to sign in
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
