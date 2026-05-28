"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { verificationApi } from "@/lib/api/verification";
import { useAuth } from "@/contexts/auth-context";
import { verifyEmailSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

type VerifyEmailForm = z.infer<typeof verifyEmailSchema>;

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<VerifyEmailForm>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      token: searchParams.get("token") || "",
    },
  });

  const onSubmit = async (data: VerifyEmailForm) => {
    setLoading(true);
    setError(null);

    try {
      await verificationApi.verifyEmail({ token: data.token });
      await refreshUser();
      toast({
        title: "Success",
        description: "Email verified successfully",
        variant: "success",
      });
      router.push("/security");
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(apiError.response?.data?.error?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Verify email</CardTitle>
          <CardDescription>
            Enter the verification token from your email, or use the link we sent you.
          </CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <p>{error}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="token">Verification token</Label>
              <Input id="token" {...form.register("token")} disabled={loading} />
              {form.formState.errors.token && (
                <p className="text-sm text-red-600">{form.formState.errors.token.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Verify email"}
            </Button>
            <Link href="/security" className="text-sm text-blue-600 hover:underline">
              Back to security settings
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
