"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/auth-context";
import { registerSchema } from "@/lib/validators";
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

function RegisterForm() {
  const { register: registerUser } = useAuth();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<{
    email?: string;
    phoneNumber?: string;
  } | null>(null);
  const [validatingToken, setValidatingToken] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterRequest>({
    resolver: zodResolver(registerSchema),
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

  useEffect(() => {
    if (token) {
      authApi
        .validateInviteToken(token)
        .then((data) => {
          setInviteData(data);
          setValidatingToken(false);
        })
      .catch(() => {
        setError("Invalid or expired invitation token");
        setValidatingToken(false);
      });
    } else {
      setError("No invitation token provided");
      setValidatingToken(false);
    }
  }, [token]);

  const onSubmit = async (data: RegisterRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      await registerUser(data);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (validatingToken) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (!inviteData) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Invalid Invitation</CardTitle>
            <CardDescription>
              The invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/login" className="w-full">
              <Button variant="outline" className="w-full">
                Back to Login
              </Button>
            </Link>
          </CardFooter>
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
            Complete your registration to get started
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                defaultValue={inviteData.email || ""}
                {...register("email")}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Choose a username"
                {...register("username")}
                disabled={isLoading}
              />
              {errors.username && (
                <p className="text-sm text-red-600">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Choose a strong password"
                {...register("password")}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
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
                  {...register("firstName")}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Optional"
                  {...register("lastName")}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="Optional"
                defaultValue={inviteData.phoneNumber || ""}
                {...register("phoneNumber")}
                disabled={isLoading}
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create account"}
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
    <Suspense fallback={<div>Loading...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
