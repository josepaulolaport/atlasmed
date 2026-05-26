"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { verificationApi } from "@/lib/api/verification";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  Shield,
  Key,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

export default function SecurityPage() {
  const { user } = useAuth();
  const [emailLoading, setEmailLoading] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);

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

  if (!user) return null;

  const securityScore = 
    (user.emailVerified ? 25 : 0) +
    (user.phoneVerified ? 25 : 0) +
    (user.status === "ACTIVE" ? 50 : 0);

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
                  <div className="text-3xl font-bold text-gray-900">
                    {securityScore}%
                  </div>
                  <p className="text-sm text-gray-600">
                    {securityScore >= 75
                      ? "Strong"
                      : securityScore >= 50
                      ? "Medium"
                      : "Weak"}
                  </p>
                </div>
                <div className="h-24 w-24 rounded-full border-8 border-gray-200 flex items-center justify-center">
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
                <Button
                  onClick={handleRequestEmailVerification}
                  disabled={emailLoading}
                >
                  {emailLoading ? "Sending..." : "Verify Email"}
                </Button>
              )}
            </div>
            {!user.emailVerified && (
              <div className="mt-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                <AlertTriangle className="mr-2 inline h-4 w-4" />
                Verify your email to improve account security and receive
                important notifications.
              </div>
            )}
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
                      <>
                        <Badge variant="success">Verified</Badge>
                        {user.phoneVerifiedAt && (
                          <span className="text-xs text-gray-500">
                            Verified on{" "}
                            {new Date(user.phoneVerifiedAt).toLocaleDateString()}
                          </span>
                        )}
                      </>
                    ) : (
                      <Badge variant="destructive">Not Verified</Badge>
                    )}
                  </div>
                </div>
                {!user.phoneVerified && (
                  <Button
                    onClick={handleRequestPhoneVerification}
                    disabled={phoneLoading}
                  >
                    {phoneLoading ? "Sending..." : "Verify Phone"}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  No phone number associated with your account.
                </p>
                <Link href="/profile">
                  <Button variant="outline">Add Phone Number</Button>
                </Link>
              </div>
            )}
            {user.phoneNumber && !user.phoneVerified && (
              <div className="mt-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                <AlertTriangle className="mr-2 inline h-4 w-4" />
                Verify your phone number for additional security and SMS
                notifications.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Password & Authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Password</p>
                <p className="text-sm text-gray-600">
                  Last changed: Never (or unknown)
                </p>
              </div>
              <Link href="/forgot-password">
                <Button variant="outline">Change Password</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {!user.emailVerified && (
                <li className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="font-medium">Verify your email address</p>
                    <p className="text-gray-600">
                      Email verification adds an extra layer of security to your
                      account.
                    </p>
                  </div>
                </li>
              )}
              {user.phoneNumber && !user.phoneVerified && (
                <li className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="font-medium">Verify your phone number</p>
                    <p className="text-gray-600">
                      Phone verification enables SMS notifications and account
                      recovery.
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
