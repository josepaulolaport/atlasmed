"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/auth-context";
import { loginSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LoginRequest } from "@/types/auth";

function getLoginErrorMessage(err: unknown): { message: string; code?: string } {
  const error = err as {
    response?: { data?: { error?: { message?: string; code?: string } } };
  };
  return {
    message: error.response?.data?.error?.message || "Invalid credentials",
    code: error.response?.data?.error?.code,
  };
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("reason") === "refresh_reuse") {
      setError(
        "Sua sessão foi encerrada devido a atividade suspeita. Entre novamente."
      );
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      await login(data);
    } catch (err) {
      const { message } = getLoginErrorMessage(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold tracking-tighter text-zinc-900">
            ATLASMED
          </h1>
          <p className="text-sm text-zinc-500 mt-2">
            Operações Comerciais em Saúde
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-6">
          <h2 className="text-lg font-medium text-zinc-900">Entrar</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Insira suas credenciais para acessar sua conta
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
              <Label htmlFor="identifier">Email, usuário ou telefone</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="you@example.com"
                {...register("identifier")}
                disabled={isLoading}
              />
              {errors.identifier && (
                <p className="text-xs text-red-600">
                  {errors.identifier.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Digite sua senha"
                {...register("password")}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>

            <p className="text-center text-sm text-zinc-500 pt-2">
              Novo no AtlasMed?{" "}
              <Link
                href="/register"
                className="text-blue-600 hover:underline font-medium"
              >
                Cadastrar com token
              </Link>
            </p>
          </form>
        </div>
        <p className="text-center text-xs text-zinc-500 mt-6">
          &copy; AtlasMed 2026
        </p>
      </div>
    </div>
  );
}
