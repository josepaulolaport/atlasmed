"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/auth-context";
import { authApi } from "@/lib/api/auth";
import { verificationApi } from "@/lib/api/verification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  changePasswordSchema,
  disable2FASchema,
  totpCodeSchema,
} from "@/lib/validators";
import { z } from "zod";

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;
type Disable2FAForm = z.infer<typeof disable2FASchema>;

const confirm2FASchema = z.object({ code: totpCodeSchema });
type Confirm2FAFormData = z.infer<typeof confirm2FASchema>;

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center gap-2">
        <iconify-icon
          icon={icon}
          stroke-width="1.5"
          className="text-base text-zinc-500"
        />
        <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
          {title}
        </h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function SecurityPage() {
  const { user, refreshUser } = useAuth();
  const [emailLoading, setEmailLoading] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [showDisable2FA, setShowDisable2FA] = useState(false);

  const changePasswordForm = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { revokeOtherSessions: true },
  });

  const confirm2FAForm = useForm<Confirm2FAFormData>({
    resolver: zodResolver(confirm2FASchema),
  });

  const disable2FAForm = useForm<Disable2FAForm>({
    resolver: zodResolver(disable2FASchema),
  });

  const handleRequestEmailVerification = async () => {
    setEmailLoading(true);
    try {
      await verificationApi.requestEmailVerification();
      toast({
        title: "Sucesso",
        description: "E-mail de verificação enviado. Verifique sua caixa de entrada.",
        variant: "success",
      });
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      toast({
        title: "Erro",
        description:
          error.response?.data?.message || "Falha ao enviar e-mail de verificação",
        variant: "destructive",
      });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleRequestPhoneVerification = async () => {
    setPhoneLoading(true);
    try {
      await verificationApi.requestPhoneVerification();
      toast({
        title: "Sucesso",
        description: "Código de verificação enviado para o seu telefone.",
        variant: "success",
      });
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      toast({
        title: "Erro",
        description:
          error.response?.data?.message || "Falha ao enviar código de verificação",
        variant: "destructive",
      });
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleChangePassword = async (data: ChangePasswordForm) => {
    setPasswordLoading(true);
    try {
      await authApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        revokeOtherSessions: data.revokeOtherSessions,
      });
      changePasswordForm.reset({ revokeOtherSessions: true });
      toast({
        title: "Sucesso",
        description: "Senha alterada com sucesso",
        variant: "success",
      });
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      toast({
        title: "Erro",
        description: error.response?.data?.error || "Falha ao alterar senha",
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleStart2FASetup = async () => {
    setTwoFactorLoading(true);
    try {
      const result = await authApi.setup2FA();
      setSetupData(result);
      toast({
        title: "Configuração iniciada",
        description:
          "Escaneie o código ou insira o segredo no seu aplicativo autenticador.",
        variant: "success",
      });
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      toast({
        title: "Erro",
        description:
          error.response?.data?.error ||
          "Autenticação em dois fatores indisponível",
        variant: "destructive",
      });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleConfirm2FA = async (data: Confirm2FAFormData) => {
    setTwoFactorLoading(true);
    try {
      await authApi.confirm2FA({ code: data.code });
      setSetupData(null);
      confirm2FAForm.reset();
      await refreshUser();
      toast({
        title: "Sucesso",
        description: "Autenticação em dois fatores ativada",
        variant: "success",
      });
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      toast({
        title: "Erro",
        description:
          error.response?.data?.error || "Código de verificação inválido",
        variant: "destructive",
      });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDisable2FA = async (data: Disable2FAForm) => {
    setTwoFactorLoading(true);
    try {
      await authApi.disable2FA(data);
      setShowDisable2FA(false);
      disable2FAForm.reset();
      await refreshUser();
      toast({
        title: "Sucesso",
        description: "Autenticação em dois fatores desativada",
        variant: "success",
      });
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      toast({
        title: "Erro",
        description:
          error.response?.data?.error ||
          "Falha ao desativar autenticação em dois fatores",
        variant: "destructive",
      });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  if (!user) return null;

  const securityScore =
    (user.status === "ACTIVE" ? 40 : 0) +
    (user.emailVerified ? 20 : 0) +
    (user.phoneVerified ? 15 : 0) +
    (user.twoFactorEnabled ? 25 : 0);

  return (
    <>
      <div className="px-6 py-8 border-b border-zinc-100">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-zinc-900">
              Configurações de segurança
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Gerencie a segurança e as verificações da sua conta
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        <SectionCard title="Pontuação de segurança" icon="solar:shield-check-linear">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-medium tracking-tight text-zinc-900">
                  {securityScore}%
                </div>
                <p className="text-sm text-zinc-500 mt-1">
                  {securityScore >= 75
                    ? "Forte"
                    : securityScore >= 50
                    ? "Média"
                    : "Fraca"}
                </p>
              </div>
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-zinc-100">
                <iconify-icon
                  icon={
                    securityScore >= 75
                      ? "solar:check-circle-linear"
                      : "solar:danger-triangle-linear"
                  }
                  stroke-width="1.5"
                  className={
                    securityScore >= 75
                      ? "text-2xl text-emerald-600"
                      : "text-2xl text-amber-500"
                  }
                />
              </div>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full transition-all ${
                  securityScore >= 75
                    ? "bg-emerald-500"
                    : securityScore >= 50
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${securityScore}%` }}
              />
            </div>

            <ul className="space-y-2 text-sm">
              {[
                { label: "Conta ativa", passed: user.status === "ACTIVE" },
                { label: "Email verificado", passed: user.emailVerified },
                { label: "Telefone verificado", passed: user.phoneVerified },
                {
                  label: "Autenticação de dois fatores ativada",
                  passed: user.twoFactorEnabled,
                },
              ].map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  <iconify-icon
                    icon={
                      item.passed
                        ? "solar:check-circle-linear"
                        : "solar:close-circle-linear"
                    }
                    stroke-width="1.5"
                    className={
                      item.passed
                        ? "text-base text-emerald-600"
                        : "text-base text-zinc-400"
                    }
                  />
                  <span className="text-zinc-700">{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </SectionCard>

        <SectionCard title="Verificação de email" icon="solar:letter-linear">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-900">{user.email}</p>
              <div className="flex items-center gap-2">
                {user.emailVerified ? (
                  <>
                    <Badge variant="success">Verificado</Badge>
                    {user.emailVerifiedAt && (
                      <span className="text-xs text-zinc-500">
                        Verificado em{" "}
                        {new Date(user.emailVerifiedAt).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </>
                ) : (
                  <Badge variant="destructive">Não verificado</Badge>
                )}
              </div>
            </div>
            {!user.emailVerified && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="primary"
                  onClick={handleRequestEmailVerification}
                  disabled={emailLoading}
                >
                  {emailLoading ? "Enviando..." : "Enviar email de verificação"}
                </Button>
                <Link href="/security/verify-email">
                  <Button variant="outline">Inserir token de verificação</Button>
                </Link>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Verificação de telefone" icon="solar:phone-linear">
          {user.phoneNumber ? (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-900">
                  {user.phoneNumber}
                </p>
                <div className="flex items-center gap-2">
                  {user.phoneVerified ? (
                    <Badge variant="success">Verificado</Badge>
                  ) : (
                    <Badge variant="destructive">Não verificado</Badge>
                  )}
                </div>
              </div>
              {!user.phoneVerified && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="primary"
                    onClick={handleRequestPhoneVerification}
                    disabled={phoneLoading}
                  >
                    {phoneLoading ? "Enviando..." : "Enviar código de verificação"}
                  </Button>
                  <Link href="/security/verify-phone">
                    <Button variant="outline">Inserir código</Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">
                Nenhum telefone associado à sua conta.
              </p>
              <Link href="/profile">
                <Button variant="outline">Adicionar telefone</Button>
              </Link>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Alterar senha" icon="solar:key-linear">
          <form
            onSubmit={changePasswordForm.handleSubmit(handleChangePassword)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Senha atual</Label>
              <Input
                id="currentPassword"
                type="password"
                {...changePasswordForm.register("currentPassword")}
                disabled={passwordLoading}
              />
              {changePasswordForm.formState.errors.currentPassword && (
                <p className="text-xs text-red-600">
                  {changePasswordForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <Input
                id="newPassword"
                type="password"
                {...changePasswordForm.register("newPassword")}
                disabled={passwordLoading}
              />
              {changePasswordForm.formState.errors.newPassword && (
                <p className="text-xs text-red-600">
                  {changePasswordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...changePasswordForm.register("confirmPassword")}
                disabled={passwordLoading}
              />
              {changePasswordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-red-600">
                  {changePasswordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                {...changePasswordForm.register("revokeOtherSessions")}
                disabled={passwordLoading}
              />
              Sair de todos os outros dispositivos
            </label>
            <Button
              type="submit"
              variant="primary"
              disabled={passwordLoading}
            >
              {passwordLoading ? "Atualizando..." : "Atualizar senha"}
            </Button>
          </form>
        </SectionCard>

        <SectionCard
          title="Autenticação de dois fatores"
          icon="solar:smartphone-linear"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  Aplicativo autenticador
                </p>
                <p className="text-sm text-zinc-500 mt-1">
                  Use um aplicativo TOTP como Google Authenticator ou 1Password.
                </p>
              </div>
              {user.twoFactorEnabled ? (
                <Badge variant="success">Ativado</Badge>
              ) : (
                <Badge variant="secondary">Desativado</Badge>
              )}
            </div>

            {!user.twoFactorEnabled && !setupData && (
              <Button
                variant="primary"
                onClick={handleStart2FASetup}
                disabled={twoFactorLoading}
              >
                {twoFactorLoading
                  ? "Iniciando..."
                  : "Ativar autenticação de dois fatores"}
              </Button>
            )}

            {setupData && (
              <div className="space-y-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm text-zinc-600">
                  Adicione esta conta ao seu aplicativo autenticador usando o
                  segredo abaixo ou o link de configuração.
                </p>
                <div className="rounded bg-white border border-zinc-200 p-3 font-mono text-sm break-all text-zinc-800">
                  {setupData.secret}
                </div>
                <a
                  href={setupData.otpauthUrl}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Abrir no aplicativo autenticador
                </a>
                <form
                  onSubmit={confirm2FAForm.handleSubmit(handleConfirm2FA)}
                  className="space-y-3"
                >
                  <div className="space-y-2">
                    <Label htmlFor="confirmCode">Código de verificação</Label>
                    <Input
                      id="confirmCode"
                      inputMode="numeric"
                      maxLength={6}
                      {...confirm2FAForm.register("code")}
                      disabled={twoFactorLoading}
                    />
                    {confirm2FAForm.formState.errors.code && (
                      <p className="text-xs text-red-600">
                        {confirm2FAForm.formState.errors.code.message}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={twoFactorLoading}
                    >
                      {twoFactorLoading ? "Confirmando..." : "Confirmar configuração"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSetupData(null)}
                      disabled={twoFactorLoading}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {user.twoFactorEnabled && (
              <div className="space-y-3">
                {!showDisable2FA ? (
                  <Button
                    variant="outline"
                    onClick={() => setShowDisable2FA(true)}
                  >
                    Desativar autenticação de dois fatores
                  </Button>
                ) : (
                  <form
                    onSubmit={disable2FAForm.handleSubmit(handleDisable2FA)}
                    className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="disablePassword">Senha</Label>
                      <Input
                        id="disablePassword"
                        type="password"
                        {...disable2FAForm.register("password")}
                        disabled={twoFactorLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="disableCode">Código do autenticador</Label>
                      <Input
                        id="disableCode"
                        inputMode="numeric"
                        maxLength={6}
                        {...disable2FAForm.register("code")}
                        disabled={twoFactorLoading}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        variant="destructive"
                        disabled={twoFactorLoading}
                      >
                        {twoFactorLoading ? "Desativando..." : "Confirmar desativação"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowDisable2FA(false)}
                        disabled={twoFactorLoading}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Informações de contato"
          icon="solar:user-id-linear"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/security/change-email">
              <Button variant="outline">Alterar email</Button>
            </Link>
            <Link href="/security/change-phone">
              <Button variant="outline">Alterar telefone</Button>
            </Link>
          </div>
        </SectionCard>

        <SectionCard
          title="Recomendações de segurança"
          icon="solar:lightbulb-linear"
        >
          <ul className="space-y-3 text-sm">
            {!user.twoFactorEnabled && (
              <li className="flex items-start gap-2">
                <iconify-icon
                  icon="solar:danger-triangle-linear"
                  stroke-width="1.5"
                  className="text-base text-amber-500 mt-0.5"
                />
                <div>
                  <p className="font-medium text-zinc-900">
                    Ative a autenticação de dois fatores
                  </p>
                  <p className="text-zinc-500">
                    Proteja sua conta com uma segunda etapa de verificação no
                    login.
                  </p>
                </div>
              </li>
            )}
            <li className="flex items-start gap-2">
              <iconify-icon
                icon="solar:shield-check-linear"
                stroke-width="1.5"
                className="text-base text-blue-600 mt-0.5"
              />
              <div>
                <p className="font-medium text-zinc-900">
                  Revise suas sessões ativas
                </p>
                <p className="text-zinc-500">
                  Verifique regularmente dispositivos e locais não reconhecidos.{" "}
                  <Link
                    href="/sessions"
                    className="text-blue-600 hover:underline"
                  >
                    Ver sessões
                  </Link>
                </p>
              </div>
            </li>
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
