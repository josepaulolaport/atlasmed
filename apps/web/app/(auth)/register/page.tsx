"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/auth-context";
import { inviteTokenSchema, registerSchema } from "@/lib/validators";
import { authApi } from "@/lib/api/auth";
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
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import type { RegisterRequest } from "@/types/auth";
import { z } from "zod";

type InviteTokenForm = z.infer<typeof inviteTokenSchema>;

interface ValidatedInvite {
  email?: string;
  phoneNumber?: string;
  role: { id: string; name: string };
  expiresAt: string;
}

function RegisterForm() {
  const { register: registerUser } = useAuth();
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") || "";

  const [validatedInvite, setValidatedInvite] = useState<ValidatedInvite | null>(null);
  const [registrationToken, setRegistrationToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenForm = useForm<InviteTokenForm>({
    resolver: zodResolver(inviteTokenSchema),
    defaultValues: { token: initialToken },
  });

  const registerForm = useForm<RegisterRequest>({
    resolver: zodResolver(registerSchema),
    defaultValues: { token: "" },
  });

  const password = registerForm.watch("password");
  const canShowRegistrationForm = validatedInvite !== null && registrationToken.length > 0;

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

  const resetToTokenStep = () => {
    setValidatedInvite(null);
    setRegistrationToken("");
    setError(null);
    registerForm.reset({ token: "" });
  };

  const handleValidateToken = async (data: InviteTokenForm) => {
    const token = data.token.trim();
    setIsLoading(true);
    setError(null);
    resetToTokenStep();

    try {
      const validated = await authApi.validateInviteToken(token);
      setRegistrationToken(token);
      setValidatedInvite(validated);
      registerForm.reset({
        token,
        email: validated.email || "",
        phoneNumber: validated.phoneNumber || "",
      });
    } catch {
      setError("Invalid, expired, or already used registration token");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitRegistration = async (data: RegisterRequest) => {
    if (!canShowRegistrationForm) {
      setError("Validate your registration token before continuing");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await authApi.validateInviteToken(registrationToken);
      await registerUser({ ...data, token: registrationToken });
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: { message?: string } } } };
      const message =
        apiError.response?.data?.error?.message ||
        "Registration failed. Your token may have expired — validate it again.";

      if (
        message.toLowerCase().includes("invite") ||
        message.toLowerCase().includes("token")
      ) {
        resetToTokenStep();
      }

      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!canShowRegistrationForm) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">Join AtlasMed</CardTitle>
            <CardDescription>
              Enter your registration token to continue. You received this token by
              email or SMS when you were invited.
            </CardDescription>
          </CardHeader>
          <form onSubmit={tokenForm.handleSubmit(handleValidateToken)}>
            <CardContent className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="token">Registration token</Label>
                <Input
                  id="token"
                  type="text"
                  placeholder="Paste your invite token"
                  autoComplete="off"
                  {...tokenForm.register("token")}
                  disabled={isLoading}
                />
                {tokenForm.formState.errors.token && (
                  <p className="text-sm text-red-600">
                    {tokenForm.formState.errors.token.message}
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Validating..." : "Continue"}
              </Button>
              <p className="text-center text-sm text-gray-600">
                Already have an account?{" "}
                <Link href="/login" className="text-blue-600 hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Create your account</CardTitle>
          <CardDescription>
            Complete registration for the {validatedInvite.role.name} role
          </CardDescription>
        </CardHeader>
        <form onSubmit={registerForm.handleSubmit(onSubmitRegistration)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
              Registration token verified. Token expires{" "}
              {new Date(validatedInvite.expiresAt).toLocaleString()}.
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...registerForm.register("email")}
                disabled={isLoading || Boolean(validatedInvite.email)}
              />
              {registerForm.formState.errors.email && (
                <p className="text-sm text-red-600">
                  {registerForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Choose a username"
                {...registerForm.register("username")}
                disabled={isLoading}
              />
              {registerForm.formState.errors.username && (
                <p className="text-sm text-red-600">
                  {registerForm.formState.errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Choose a strong password"
                {...registerForm.register("password")}
                disabled={isLoading}
              />
              {registerForm.formState.errors.password && (
                <p className="text-sm text-red-600">
                  {registerForm.formState.errors.password.message}
                </p>
              )}

              {password && (
                <div className="space-y-2 rounded-md bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-700">
                    Password requirements:
                  </p>
                  <ul className="space-y-1">
                    {passwordRequirements.map((req, index) => {
                      const passed = req.test(password);
                      return (
                        <li
                          key={index}
                          className="flex items-center gap-2 text-xs"
                        >
                          {passed ? (
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                          ) : (
                            <X className="h-3 w-3 text-gray-400" />
                          )}
                          <span
                            className={
                              passed ? "text-green-600" : "text-gray-500"
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Optional"
                  {...registerForm.register("firstName")}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Optional"
                  {...registerForm.register("lastName")}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder={validatedInvite.phoneNumber ? undefined : "Optional"}
                {...registerForm.register("phoneNumber")}
                disabled={isLoading || Boolean(validatedInvite.phoneNumber)}
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create account"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={resetToTokenStep}
              disabled={isLoading}
            >
              Use a different token
            </Button>

            <p className="text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
