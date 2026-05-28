"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { verificationApi } from "@/lib/api/verification";
import { changeEmailSchema, changeEmailConfirmSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

type ChangeEmailForm = z.infer<typeof changeEmailSchema>;
type ConfirmEmailForm = z.infer<typeof changeEmailConfirmSchema>;

export default function ChangeEmailPage() {
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestForm = useForm<ChangeEmailForm>({
    resolver: zodResolver(changeEmailSchema),
  });

  const confirmForm = useForm<ConfirmEmailForm>({
    resolver: zodResolver(changeEmailConfirmSchema),
  });

  const handleRequest = async (data: ChangeEmailForm) => {
    setLoading(true);
    setError(null);

    try {
      await verificationApi.requestEmailChange(data);
      confirmForm.setValue("newEmail", data.newEmail);
      toast({
        title: "Check your inbox",
        description: "We sent a confirmation link to your new email address.",
        variant: "success",
      });
      setStep("confirm");
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(apiError.response?.data?.error?.message || "Failed to request email change");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (data: ConfirmEmailForm) => {
    setLoading(true);
    setError(null);

    try {
      await verificationApi.confirmEmailChange(data);
      toast({
        title: "Success",
        description: "Email address updated",
        variant: "success",
      });
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(apiError.response?.data?.error?.message || "Failed to confirm email change");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Change email</CardTitle>
          <CardDescription>
            {step === "request"
              ? "Request a change to your account email address."
              : "Enter the confirmation token from your new email."}
          </CardDescription>
        </CardHeader>

        {step === "request" ? (
          <form onSubmit={requestForm.handleSubmit(handleRequest)}>
            <CardContent className="space-y-4">
              {error && <ErrorBox message={error} />}
              <div className="space-y-2">
                <Label htmlFor="newEmail">New email</Label>
                <Input id="newEmail" type="email" {...requestForm.register("newEmail")} disabled={loading} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send confirmation"}
              </Button>
              <Link href="/security" className="text-sm text-blue-600 hover:underline">
                Back to security settings
              </Link>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={confirmForm.handleSubmit(handleConfirm)}>
            <CardContent className="space-y-4">
              {error && <ErrorBox message={error} />}
              <div className="space-y-2">
                <Label htmlFor="confirmEmail">New email</Label>
                <Input id="confirmEmail" type="email" {...confirmForm.register("newEmail")} disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmToken">Confirmation token</Label>
                <Input id="confirmToken" {...confirmForm.register("token")} disabled={loading} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Confirming..." : "Confirm new email"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep("request")} disabled={loading}>
                Start over
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
      <AlertCircle className="h-4 w-4" />
      <p>{message}</p>
    </div>
  );
}
