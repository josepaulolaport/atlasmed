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
import type { RegisterRequest } from "@/types/auth";
import { z } from "zod";

type InviteTokenForm = z.infer<typeof inviteTokenSchema>;

interface ValidatedInvite {
  email?: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  role: { id: string; name: string };
  expiresAt: string;
}

function AuthShell({ children }: { children: React.ReactNode }) {
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
        {children}
        <p className="text-center text-xs text-zinc-500 mt-6">
          &copy; AtlasMed 2026
        </p>
      </div>
    </div>
  );
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
    { label: "Pelo menos 8 caracteres", test: (p: string) => p.length >= 8 },
    { label: "Uma letra maiúscula", test: (p: string) => /[A-Z]/.test(p) },
    { label: "Uma letra minúscula", test: (p: string) => /[a-z]/.test(p) },
    { label: "Um número", test: (p: string) => /[0-9]/.test(p) },
    {
      label: "Um caractere especial",
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
        firstName: validated.firstName || "",
        lastName: validated.lastName || "",
        birthDate: "",
        username: "",
        password: "",
      });
    } catch {
      setError("Token de cadastro inválido, expirado ou já utilizado");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitRegistration = async (data: RegisterRequest) => {
    if (!canShowRegistrationForm) {
      setError("Valide seu token de cadastro antes de continuar");
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
      <AuthShell>
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-6">
          <h2 className="text-lg font-medium text-zinc-900">Junte-se ao AtlasMed</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Digite seu token de cadastro para continuar. Você recebeu este token
            por email ou SMS quando foi convidado.
          </p>
          <form
            onSubmit={tokenForm.handleSubmit(handleValidateToken)}
            className="mt-6 space-y-4"
          >
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
              <Label htmlFor="token">Token de cadastro</Label>
              <Input
                id="token"
                type="text"
                placeholder="Cole seu token de convite"
                autoComplete="off"
                {...tokenForm.register("token")}
                disabled={isLoading}
              />
              {tokenForm.formState.errors.token && (
                <p className="text-xs text-red-600">
                  {tokenForm.formState.errors.token.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Validando..." : "Continuar"}
            </Button>
            <p className="text-center text-sm text-zinc-500">
              Já tem uma conta?{" "}
              <Link
                href="/login"
                className="text-blue-600 hover:underline font-medium"
              >
                Entrar
              </Link>
            </p>
          </form>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-6">
        <h2 className="text-lg font-medium text-zinc-900">Crie sua conta</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Conclua o cadastro para a função {validatedInvite.role.name}
        </p>
        <form
          onSubmit={registerForm.handleSubmit(onSubmitRegistration)}
          className="mt-6 space-y-4"
        >
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

          <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
            Token de cadastro verificado. O token expira em{" "}
            {new Date(validatedInvite.expiresAt).toLocaleString("pt-BR")}.
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
              <p className="text-xs text-red-600">
                {registerForm.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Nome de usuário</Label>
            <Input
              id="username"
              type="text"
              placeholder="Escolha um nome de usuário"
              {...registerForm.register("username")}
              disabled={isLoading}
            />
            {registerForm.formState.errors.username && (
              <p className="text-xs text-red-600">
                {registerForm.formState.errors.username.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="Escolha uma senha forte"
              {...registerForm.register("password")}
              disabled={isLoading}
            />
            {registerForm.formState.errors.password && (
              <p className="text-xs text-red-600">
                {registerForm.formState.errors.password.message}
              </p>
            )}

            {password && (
              <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs font-medium text-zinc-700">
                  Requisitos da senha
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nome</Label>
              <Input
                id="firstName"
                type="text"
                {...registerForm.register("firstName")}
                disabled={isLoading}
              />
              {registerForm.formState.errors.firstName && (
                <p className="text-xs text-red-600">
                  {registerForm.formState.errors.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Sobrenome</Label>
              <Input
                id="lastName"
                type="text"
                {...registerForm.register("lastName")}
                disabled={isLoading}
              />
              {registerForm.formState.errors.lastName && (
                <p className="text-xs text-red-600">
                  {registerForm.formState.errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthDate">Data de nascimento</Label>
            <Input
              id="birthDate"
              type="date"
              {...registerForm.register("birthDate")}
              disabled={isLoading}
            />
            {registerForm.formState.errors.birthDate && (
              <p className="text-xs text-red-600">
                {registerForm.formState.errors.birthDate.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Telefone</Label>
            <Input
              id="phoneNumber"
              type="tel"
              placeholder={validatedInvite.phoneNumber ? undefined : "Opcional"}
              {...registerForm.register("phoneNumber")}
              disabled={isLoading || Boolean(validatedInvite.phoneNumber)}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Criando conta..." : "Criar conta"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={resetToTokenStep}
            disabled={isLoading}
          >
            Usar outro token
          </Button>

          <p className="text-center text-sm text-zinc-500">
            Já tem uma conta?{" "}
            <Link
              href="/login"
              className="text-blue-600 hover:underline font-medium"
            >
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-50">
          <div className="py-10 text-center text-sm text-zinc-500">
            Carregando…
          </div>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
