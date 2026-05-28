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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  changePasswordSchema,
  disable2FASchema,
  totpCodeSchema,
} from "@/lib/validators";
import type { AccessGrant } from "@/types/auth";
import {
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  Shield,
  Key,
  AlertTriangle,
  Smartphone,
} from "lucide-react";
import { z } from "zod";

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;
type Disable2FAForm = z.infer<typeof disable2FASchema>;

const confirm2FASchema = z.object({ code: totpCodeSchema });
type Confirm2FAFormData = z.infer<typeof confirm2FASchema>;

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
        description: error.response?.data?.message || "Failed to send verification email",
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
        description: error.response?.data?.message || "Failed to send verification code",
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
        description: "Scan the code or enter the secret in your authenticator app.",
        variant: "success",
      });
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      toast({
        title: "Error",
        description: error.response?.data?.error || "Two-factor authentication is not available",
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
        description: error.response?.data?.error || "Invalid verification code",
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
        description: error.response?.data?.error || "Failed to disable two-factor authentication",
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
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Security Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your account security and verification settings
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-gray-900">{securityScore}%</div>
                  <p className="text-sm text-gray-600">
                    {securityScore >= 75 ? "Strong" : securityScore >= 50 ? "Medium" : "Weak"}
                  </p>
                </div>
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-8 border-gray-200">
                  {securityScore >= 75 ? (
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-8 w-8 text-yellow-600" />
                  )}
                </div>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full transition-all ${
                    securityScore >= 75
                      ? "bg-green-600"
                      : securityScore >= 50
                        ? "bg-yellow-500"
                        : "bg-red-600"
                  }`}
                  style={{ width: `${securityScore}%` }}
                />
              </div>

              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  {user.status === "ACTIVE" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span>Account is active</span>
                </li>
                <li className="flex items-center gap-2">
                  {user.emailVerified ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span>Email verified</span>
                </li>
                <li className="flex items-center gap-2">
                  {user.phoneVerified ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span>Phone verified</span>
                </li>
                <li className="flex items-center gap-2">
                  {user.twoFactorEnabled ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span>Two-factor authentication enabled</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">{user.email}</p>
                <div className="flex items-center gap-2">
                  {user.emailVerified ? (
                    <>
                      <Badge variant="success">Verified</Badge>
                      {user.emailVerifiedAt && (
                        <span className="text-xs text-gray-500">
                          Verified on {new Date(user.emailVerifiedAt).toLocaleDateString()}
                        </span>
                      )}
                    </>
                  ) : (
                    <Badge variant="destructive">Not Verified</Badge>
                  )}
                </div>
              </div>
              {!user.emailVerified && (
                <div className="flex flex-col items-end gap-2 sm:flex-row">
                  <Button onClick={handleRequestEmailVerification} disabled={emailLoading}>
                    {emailLoading ? "Sending..." : "Send verification email"}
                  </Button>
                  <Link href="/security/verify-email">
                    <Button variant="outline">Enter verification token</Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Phone Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user.phoneNumber ? (
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{user.phoneNumber}</p>
                  <div className="flex items-center gap-2">
                    {user.phoneVerified ? (
                      <Badge variant="success">Verified</Badge>
                    ) : (
                      <Badge variant="destructive">Not Verified</Badge>
                    )}
                  </div>
                </div>
                {!user.phoneVerified && (
                  <div className="flex flex-col items-end gap-2 sm:flex-row">
                    <Button onClick={handleRequestPhoneVerification} disabled={phoneLoading}>
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
                <p className="text-sm text-gray-600">No phone number associated with your account.</p>
                <Link href="/profile">
                  <Button variant="outline">Add Phone Number</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePasswordForm.handleSubmit(handleChangePassword)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  {...changePasswordForm.register("currentPassword")}
                  disabled={passwordLoading}
                />
                {changePasswordForm.formState.errors.currentPassword && (
                  <p className="text-sm text-red-600">
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
                  <p className="text-sm text-red-600">
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
                  <p className="text-sm text-red-600">
                    {changePasswordForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...changePasswordForm.register("revokeOtherSessions")}
                  disabled={passwordLoading}
                />
                Sign out of all other devices
              </label>
              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading ? "Updating..." : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Two-Factor Authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Authenticator app</p>
                <p className="text-sm text-gray-600">
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
              <Button onClick={handleStart2FASetup} disabled={twoFactorLoading}>
                {twoFactorLoading ? "Starting..." : "Enable two-factor authentication"}
              </Button>
            )}

            {setupData && (
              <div className="space-y-4 rounded-md border p-4">
                <p className="text-sm text-gray-600">
                  Add this account to your authenticator app using the secret below or the setup link.
                </p>
                <div className="rounded bg-gray-50 p-3 font-mono text-sm break-all">
                  {setupData.secret}
                </div>
                <a
                  href={setupData.otpauthUrl}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Open in authenticator app
                </a>
                <form onSubmit={confirm2FAForm.handleSubmit(handleConfirm2FA)} className="space-y-3">
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
                      <p className="text-sm text-red-600">
                        {confirm2FAForm.formState.errors.code.message}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={twoFactorLoading}>
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
                  <Button variant="outline" onClick={() => setShowDisable2FA(true)}>
                    Disable two-factor authentication
                  </Button>
                ) : (
                  <form onSubmit={disable2FAForm.handleSubmit(handleDisable2FA)} className="space-y-3 rounded-md border p-4">
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
                      <Button type="submit" variant="destructive" disabled={twoFactorLoading}>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access Capabilities</CardTitle>
          </CardHeader>
          <CardContent>
            {capabilitiesLoading ? (
              <p className="text-sm text-gray-600">Loading capabilities...</p>
            ) : capabilities ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Role: <span className="font-medium">{capabilities.role}</span>
                </p>
                {capabilities.grants.length === 0 ? (
                  <p className="text-sm text-gray-600">No additional grants beyond your role.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {capabilities.grants.map((grant) => (
                      <li key={grant.id} className="rounded-md border px-3 py-2">
                        <span className="font-medium">{grant.action}</span> on{" "}
                        <span className="font-medium">{grant.resource}</span>
                        {grant.resourceId ? ` (${grant.resourceId})` : ""}
                        {grant.expiresAt && (
                          <span className="block text-xs text-gray-500">
                            Expires {new Date(grant.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-600">Unable to load capabilities.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact information</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Link href="/security/change-email">
              <Button variant="outline">Change email address</Button>
            </Link>
            <Link href="/security/change-phone">
              <Button variant="outline">Change phone number</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {!user.twoFactorEnabled && (
                <li className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="font-medium">Enable two-factor authentication</p>
                    <p className="text-gray-600">
                      Protect your account with a second verification step at sign-in.
                    </p>
                  </div>
                </li>
              )}
              <li className="flex items-start gap-2">
                <Shield className="mt-0.5 h-4 w-4 text-blue-600" />
                <div>
                  <p className="font-medium">Review your active sessions</p>
                  <p className="text-gray-600">
                    Regularly check for unrecognized devices and locations.{" "}
                    <Link href="/sessions" className="text-blue-600 hover:underline">
                      View sessions
                    </Link>
                  </p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
