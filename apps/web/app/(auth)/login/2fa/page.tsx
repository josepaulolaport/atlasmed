"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/auth-context";
import { totpCodeSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { z } from "zod";

const verify2FASchema = z.object({
  code: totpCodeSchema,
});

type Verify2FAForm = z.infer<typeof verify2FASchema>;

export default function Verify2FALoginPage() {
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
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Verification session expired</CardTitle>
            <CardDescription>
              Start over from the sign-in page to continue.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link href="/login" className="text-blue-600 hover:underline">
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">
            Two-factor authentication
          </CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
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
                <p className="text-sm text-red-600">{errors.code.message}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Verifying..." : "Verify and sign in"}
            </Button>

            <Link
              href="/login"
              className="text-center text-sm text-blue-600 hover:underline"
            >
              Back to sign in
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
