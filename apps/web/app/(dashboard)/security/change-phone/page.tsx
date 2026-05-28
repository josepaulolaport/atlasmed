"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { verificationApi } from "@/lib/api/verification";
import { changePhoneSchema, changePhoneConfirmSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

type ChangePhoneForm = z.infer<typeof changePhoneSchema>;
type ConfirmPhoneForm = z.infer<typeof changePhoneConfirmSchema>;

export default function ChangePhonePage() {
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestForm = useForm<ChangePhoneForm>({
    resolver: zodResolver(changePhoneSchema),
  });

  const confirmForm = useForm<ConfirmPhoneForm>({
    resolver: zodResolver(changePhoneConfirmSchema),
  });

  const handleRequest = async (data: ChangePhoneForm) => {
    setLoading(true);
    setError(null);

    try {
      await verificationApi.requestPhoneChange(data);
      confirmForm.setValue("newPhone", data.newPhone);
      toast({
        title: "Code sent",
        description: "We sent a verification code to your new phone number.",
        variant: "success",
      });
      setStep("confirm");
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(apiError.response?.data?.error?.message || "Failed to request phone change");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (data: ConfirmPhoneForm) => {
    setLoading(true);
    setError(null);

    try {
      await verificationApi.confirmPhoneChange(data);
      toast({
        title: "Success",
        description: "Phone number updated",
        variant: "success",
      });
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(apiError.response?.data?.error?.message || "Failed to confirm phone change");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Change phone number</CardTitle>
          <CardDescription>
            {step === "request"
              ? "Request a change to your account phone number."
              : "Enter the verification code sent to your new phone."}
          </CardDescription>
        </CardHeader>

        {step === "request" ? (
          <form onSubmit={requestForm.handleSubmit(handleRequest)}>
            <CardContent className="space-y-4">
              {error && <ErrorBox message={error} />}
              <div className="space-y-2">
                <Label htmlFor="newPhone">New phone number</Label>
                <Input id="newPhone" type="tel" {...requestForm.register("newPhone")} disabled={loading} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send verification code"}
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
                <Label htmlFor="confirmPhone">New phone number</Label>
                <Input id="confirmPhone" type="tel" {...confirmForm.register("newPhone")} disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmCode">Verification code</Label>
                <Input
                  id="confirmCode"
                  inputMode="numeric"
                  maxLength={6}
                  {...confirmForm.register("token")}
                  disabled={loading}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Confirming..." : "Confirm new phone"}
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
