"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { verificationApi } from "@/lib/api/verification";
import { useAuth } from "@/contexts/auth-context";
import { verifyPhoneSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

type VerifyPhoneForm = z.infer<typeof verifyPhoneSchema>;

export default function VerifyPhonePage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<VerifyPhoneForm>({
    resolver: zodResolver(verifyPhoneSchema),
  });

  const onSubmit = async (data: VerifyPhoneForm) => {
    setLoading(true);
    setError(null);

    try {
      await verificationApi.verifyPhone({ token: data.code });
      await refreshUser();
      toast({
        title: "Success",
        description: "Phone verified successfully",
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
          <CardTitle>Verify phone</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to your phone number.
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
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                inputMode="numeric"
                maxLength={6}
                {...form.register("code")}
                disabled={loading}
              />
              {form.formState.errors.code && (
                <p className="text-sm text-red-600">{form.formState.errors.code.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Verify phone"}
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
