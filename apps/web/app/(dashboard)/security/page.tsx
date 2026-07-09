"use client";

import { useEffect, useState } from "react";
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
import type { AccessGrant } from "@/types/auth";
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
  const [capabilities, setCapabilities] = useState<{ role: string; grants: AccessGrant[] } | null>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);

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

  useEffect(() => {
    authApi
      .getCapabilities()
      .then(setCapabilities)
      .catch(() => setCapabilities(null))
      .finally(() => setCapabilitiesLoading(false));
  }, []);

  const handleRequestEmailVerification = async () => {
    setEmailLoading(true);
    try {
      await verificationApi.requestEmailVerification();
      toast({
        title: "Success",
        description: "Verification email sent. Please check your inbox.",
        variant: "success",
      });
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      toast({
        title: "Error",
        description:
          error.response?.data?.message || "Failed to send verification email",
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
        title: "Success",
        description: "Verification code sent to your phone.",
        variant: "success",
      });
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      toast({
        title: "Error",
        description:
          error.response?.data?.message || "Failed to send verification code",
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
        title: "Success",
        description: "Password changed successfully",
        variant: "success",
      });
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to change password",
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
        title: "Setup started",
        description:
          "Scan the code or enter the secret in your authenticator app.",
        variant: "success",
      });
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      toast({
        title: "Error",
        description:
          error.response?.data?.error ||
          "Two-factor authentication is not available",
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
        title: "Success",
        description: "Two-factor authentication enabled",
        variant: "success",
      });
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      toast({
        title: "Error",
        description:
          error.response?.data?.error || "Invalid verification code",
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
        title: "Success",
        description: "Two-factor authentication disabled",
        variant: "success",
      });
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      toast({
        title: "Error",
        description:
          error.response?.data?.error ||
          "Failed to disable two-factor authentication",
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
              Security Settings
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Manage your account security and verification settings
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        <SectionCard title="Security Score" icon="solar:shield-check-linear">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-medium tracking-tight text-zinc-900">
                  {securityScore}%
                </div>
                <p className="text-sm text-zinc-500 mt-1">
                  {securityScore >= 75
                    ? "Strong"
                    : securityScore >= 50
                    ? "Medium"
                    : "Weak"}
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
                { label: "Account is active", passed: user.status === "ACTIVE" },
                { label: "Email verified", passed: user.emailVerified },
                { label: "Phone verified", passed: user.phoneVerified },
                {
                  label: "Two-factor authentication enabled",
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

        <SectionCard title="Email Verification" icon="solar:letter-linear">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-900">{user.email}</p>
              <div className="flex items-center gap-2">
                {user.emailVerified ? (
                  <>
                    <Badge variant="success">Verified</Badge>
                    {user.emailVerifiedAt && (
                      <span className="text-xs text-zinc-500">
                        Verified on{" "}
                        {new Date(user.emailVerifiedAt).toLocaleDateString()}
                      </span>
                    )}
                  </>
                ) : (
                  <Badge variant="destructive">Not Verified</Badge>
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
                  {emailLoading ? "Sending..." : "Send verification email"}
                </Button>
                <Link href="/security/verify-email">
                  <Button variant="outline">Enter verification token</Button>
                </Link>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Phone Verification" icon="solar:phone-linear">
          {user.phoneNumber ? (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-900">
                  {user.phoneNumber}
                </p>
                <div className="flex items-center gap-2">
                  {user.phoneVerified ? (
                    <Badge variant="success">Verified</Badge>
                  ) : (
                    <Badge variant="destructive">Not Verified</Badge>
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
                    {phoneLoading ? "Sending..." : "Send verification code"}
                  </Button>
                  <Link href="/security/verify-phone">
                    <Button variant="outline">Enter code</Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">
                No phone number associated with your account.
              </p>
              <Link href="/profile">
                <Button variant="outline">Add phone number</Button>
              </Link>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Change Password" icon="solar:key-linear">
          <form
            onSubmit={changePasswordForm.handleSubmit(handleChangePassword)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
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
              <Label htmlFor="newPassword">New password</Label>
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
              <Label htmlFor="confirmPassword">Confirm new password</Label>
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
              Sign out of all other devices
            </label>
            <Button
              type="submit"
              variant="primary"
              disabled={passwordLoading}
            >
              {passwordLoading ? "Updating..." : "Update password"}
            </Button>
          </form>
        </SectionCard>

        <SectionCard
          title="Two-Factor Authentication"
          icon="solar:smartphone-linear"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  Authenticator app
                </p>
                <p className="text-sm text-zinc-500 mt-1">
                  Use a TOTP app such as Google Authenticator or 1Password.
                </p>
              </div>
              {user.twoFactorEnabled ? (
                <Badge variant="success">Enabled</Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )}
            </div>

            {!user.twoFactorEnabled && !setupData && (
              <Button
                variant="primary"
                onClick={handleStart2FASetup}
                disabled={twoFactorLoading}
              >
                {twoFactorLoading
                  ? "Starting..."
                  : "Enable two-factor authentication"}
              </Button>
            )}

            {setupData && (
              <div className="space-y-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm text-zinc-600">
                  Add this account to your authenticator app using the secret
                  below or the setup link.
                </p>
                <div className="rounded bg-white border border-zinc-200 p-3 font-mono text-sm break-all text-zinc-800">
                  {setupData.secret}
                </div>
                <a
                  href={setupData.otpauthUrl}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Open in authenticator app
                </a>
                <form
                  onSubmit={confirm2FAForm.handleSubmit(handleConfirm2FA)}
                  className="space-y-3"
                >
                  <div className="space-y-2">
                    <Label htmlFor="confirmCode">Verification code</Label>
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
                      {twoFactorLoading ? "Confirming..." : "Confirm setup"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSetupData(null)}
                      disabled={twoFactorLoading}
                    >
                      Cancel
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
                    Disable two-factor authentication
                  </Button>
                ) : (
                  <form
                    onSubmit={disable2FAForm.handleSubmit(handleDisable2FA)}
                    className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="disablePassword">Password</Label>
                      <Input
                        id="disablePassword"
                        type="password"
                        {...disable2FAForm.register("password")}
                        disabled={twoFactorLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="disableCode">Authenticator code</Label>
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
                        {twoFactorLoading ? "Disabling..." : "Confirm disable"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowDisable2FA(false)}
                        disabled={twoFactorLoading}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Access Capabilities" icon="solar:key-square-linear">
          {capabilitiesLoading ? (
            <p className="text-sm text-zinc-500">Loading capabilities...</p>
          ) : capabilities ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-700">
                Role:{" "}
                <span className="font-medium text-zinc-900">
                  {capabilities.role}
                </span>
              </p>
              {capabilities.grants.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No additional grants beyond your role.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {capabilities.grants.map((grant) => (
                    <li
                      key={grant.id}
                      className="rounded-md border border-zinc-200 bg-white px-3 py-2"
                    >
                      <span className="font-medium text-zinc-900">
                        {grant.action}
                      </span>{" "}
                      on{" "}
                      <span className="font-medium text-zinc-900">
                        {grant.resource}
                      </span>
                      {grant.resourceId ? ` (${grant.resourceId})` : ""}
                      {grant.expiresAt && (
                        <span className="block text-xs text-zinc-500 mt-0.5">
                          Expires{" "}
                          {new Date(grant.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              Unable to load capabilities.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Contact Information"
          icon="solar:user-id-linear"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/security/change-email">
              <Button variant="outline">Change email address</Button>
            </Link>
            <Link href="/security/change-phone">
              <Button variant="outline">Change phone number</Button>
            </Link>
          </div>
        </SectionCard>

        <SectionCard
          title="Security Recommendations"
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
                    Enable two-factor authentication
                  </p>
                  <p className="text-zinc-500">
                    Protect your account with a second verification step at
                    sign-in.
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
                  Review your active sessions
                </p>
                <p className="text-zinc-500">
                  Regularly check for unrecognized devices and locations.{" "}
                  <Link
                    href="/sessions"
                    className="text-blue-600 hover:underline"
                  >
                    View sessions
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
