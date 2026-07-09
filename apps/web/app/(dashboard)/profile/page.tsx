"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/auth-context";
import { usersApi } from "@/lib/api/users";
import { useTerritoryLabels } from "@/components/territory/territory-picker";
import { updateProfileSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { UpdateProfileRequest, UserAssignments } from "@/types/auth";
import { getInitials, formatDateTime } from "@/lib/utils";
import Link from "next/link";

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<UserAssignments | null>(null);
  const { getLabel } = useTerritoryLabels();

  useEffect(() => {
    if (!user) return;
    usersApi
      .getUserAssignments(user.id)
      .then(setAssignments)
      .catch(() => setAssignments(null));
  }, [user]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProfileRequest>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      avatarUrl: user?.avatarUrl || "",
    },
  });

  const onSubmit = async (data: UpdateProfileRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      await updateProfile(data);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <div className="px-6 py-8 border-b border-zinc-100">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-zinc-900">
              Profile Settings
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Manage your account information and preferences
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50">
            <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
              Account Overview
            </h3>
          </div>
          <div className="p-5 space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.avatarUrl} alt={user.username} />
                <AvatarFallback className="text-lg">
                  {getInitials(user.firstName, user.lastName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-base font-medium text-zinc-900">
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.username}
                </h3>
                <p className="text-sm text-zinc-500">@{user.username}</p>
                <div className="mt-2">
                  <Badge variant="secondary">{user.role.name}</Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <iconify-icon
                    icon="solar:letter-linear"
                    stroke-width="1.5"
                    className="text-base text-zinc-500"
                  />
                  <span className="text-zinc-700">{user.email}</span>
                  <iconify-icon
                    icon={
                      user.emailVerified
                        ? "solar:check-circle-linear"
                        : "solar:close-circle-linear"
                    }
                    stroke-width="1.5"
                    className={
                      user.emailVerified
                        ? "text-base text-emerald-600"
                        : "text-base text-red-600"
                    }
                  />
                </div>
                {!user.emailVerified && (
                  <Link href="/security/verify-email">
                    <Button variant="link" size="sm" className="h-auto p-0">
                      Verify email
                    </Button>
                  </Link>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <iconify-icon
                    icon="solar:phone-linear"
                    stroke-width="1.5"
                    className="text-base text-zinc-500"
                  />
                  <span className="text-zinc-700">
                    {user.phoneNumber || "No phone number"}
                  </span>
                  {user.phoneNumber && (
                    <iconify-icon
                      icon={
                        user.phoneVerified
                          ? "solar:check-circle-linear"
                          : "solar:close-circle-linear"
                      }
                      stroke-width="1.5"
                      className={
                        user.phoneVerified
                          ? "text-base text-emerald-600"
                          : "text-base text-red-600"
                      }
                    />
                  )}
                </div>
                {user.phoneNumber && !user.phoneVerified && (
                  <Link href="/security/verify-phone">
                    <Button variant="link" size="sm" className="h-auto p-0">
                      Verify phone
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            <div className="grid gap-4 text-sm md:grid-cols-2">
              <div>
                <span className="text-zinc-500">Account status:</span>{" "}
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
              <div>
                <span className="text-zinc-500">Member since:</span>{" "}
                <span className="font-medium text-zinc-900">
                  {formatDateTime(user.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {assignments && assignments.territories.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50">
              <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                Assigned Territories
              </h3>
            </div>
            <div className="p-5">
              <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200">
                {assignments.territories.map((t) => (
                  <li key={t.territoryId} className="px-3 py-2 text-sm">
                    <span className="font-medium text-zinc-900">
                      {getLabel(t.territoryId)}
                    </span>
                    <p className="text-xs text-zinc-500">
                      Assigned {formatDateTime(t.assignedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50">
            <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
              Edit Profile
            </h3>
          </div>
          <div className="p-5">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    {...register("firstName")}
                    disabled={isLoading}
                  />
                  {errors.firstName && (
                    <p className="text-xs text-red-600">
                      {errors.firstName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    {...register("lastName")}
                    disabled={isLoading}
                  />
                  {errors.lastName && (
                    <p className="text-xs text-red-600">
                      {errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatarUrl">Avatar URL</Label>
                <Input
                  id="avatarUrl"
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  {...register("avatarUrl")}
                  disabled={isLoading}
                />
                {errors.avatarUrl && (
                  <p className="text-xs text-red-600">
                    {errors.avatarUrl.message}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit" variant="primary" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save changes"}
                </Button>
                <Link href="/dashboard">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50">
            <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
              Account Actions
            </h3>
          </div>
          <div className="p-5">
            <div className="flex flex-col gap-3">
              <Link href="/security">
                <Button variant="outline" className="w-full justify-start">
                  <iconify-icon
                    icon="solar:shield-check-linear"
                    stroke-width="1.5"
                    className="text-base"
                  />
                  Security settings
                </Button>
              </Link>
              <Link href="/sessions">
                <Button variant="outline" className="w-full justify-start">
                  <iconify-icon
                    icon="solar:monitor-linear"
                    stroke-width="1.5"
                    className="text-base"
                  />
                  Manage sessions
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
