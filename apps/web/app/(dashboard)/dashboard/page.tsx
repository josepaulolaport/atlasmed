"use client";

import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Shield,
  CheckCircle2,
  XCircle,
  Activity,
  Clock,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { canManageUsers } from "@/lib/permissions";

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user.firstName || user.username}!
        </h1>
        <p className="mt-2 text-gray-600">
          Here's an overview of your account and activity.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Account Status</CardTitle>
            <User className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge
                variant={
                  user.status === "ACTIVE"
                    ? "success"
                    : user.status === "SUSPENDED"
                    ? "destructive"
                    : "secondary"
                }
              >
                {user.status}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Role: {user.role.name}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Email Verification
            </CardTitle>
            {user.emailVerified ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user.emailVerified ? "Verified" : "Not Verified"}
            </div>
            <p className="text-xs text-gray-500 mt-2">{user.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Phone Verification
            </CardTitle>
            {user.phoneVerified ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user.phoneVerified ? "Verified" : "Not Verified"}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {user.phoneNumber || "No phone number"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security</CardTitle>
            <Shield className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user.emailVerified && user.phoneVerified ? "Strong" : "Medium"}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Account security level
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Activity</CardTitle>
            <Activity className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {formatDateTime(user.updatedAt)}
            </div>
            <p className="text-xs text-gray-500 mt-2">Profile last updated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Member Since</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {formatDateTime(user.createdAt)}
            </div>
            <p className="text-xs text-gray-500 mt-2">Account created</p>
          </CardContent>
        </Card>
      </div>

      {canManageUsers(user.role.name) && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <a
                href="/users"
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Manage Users
              </a>
              <a
                href="/users/invite"
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Invite User
              </a>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
