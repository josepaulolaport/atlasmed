"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/auth-context";
import { inviteUserSchema } from "@/lib/validators";
import { usersApi } from "@/lib/api/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { AlertCircle, ArrowLeft } from "lucide-react";
import type { InviteUserRequest, RoleInfo } from "@/types/auth";
import { canManageUsers } from "@/lib/permissions";
import Link from "next/link";

export default function InviteUserPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteUserRequest>({
    resolver: zodResolver(inviteUserSchema),
  });

  useEffect(() => {
    if (currentUser && !canManageUsers(currentUser.role.name)) {
      router.push("/unauthorized");
      return;
    }

    // Fetch available roles
    const fetchRoles = async () => {
      try {
        const rolesData = await usersApi.getRoles();
        setRoles(rolesData);
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to load roles",
          variant: "destructive",
        });
      } finally {
        setLoadingRoles(false);
      }
    };

    fetchRoles();
  }, [currentUser, router]);

  const onSubmit = async (data: InviteUserRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      await usersApi.inviteUser(data);
      toast({
        title: "Success",
        description: "Invitation sent successfully",
        variant: "success",
      });
      router.push("/users/invites");
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || "Failed to send invitation");
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser || !canManageUsers(currentUser.role.name)) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link href="/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Users
          </Button>
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-gray-900">Invite User</h1>
        <p className="mt-2 text-gray-600">
          Send an invitation to a new user to join the platform
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invitation Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                {...register("email")}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
              <p className="text-xs text-gray-500">
                The invitation will be sent to this email address
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="+1234567890"
                {...register("phoneNumber")}
                disabled={isLoading}
              />
              {errors.phoneNumber && (
                <p className="text-sm text-red-600">
                  {errors.phoneNumber.message}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Optional: Send invitation via WhatsApp
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="roleId">Role</Label>
              <select
                id="roleId"
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                {...register("roleId")}
                disabled={isLoading || loadingRoles}
              >
                <option value="">Select a role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              {errors.roleId && (
                <p className="text-sm text-red-600">{errors.roleId.message}</p>
              )}
              <p className="text-xs text-gray-500">
                Assign a role to determine user permissions
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isLoading || loadingRoles}>
                {isLoading ? "Sending..." : "Send Invitation"}
              </Button>
              <Link href="/users">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            {loadingRoles ? (
              <p className="text-gray-500">Loading roles...</p>
            ) : (
              roles.map((role) => (
                <div key={role.id}>
                  <h4 className="font-medium text-gray-900">{role.name}</h4>
                  <p className="text-gray-600">
                    {role.description || "No description available"}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
