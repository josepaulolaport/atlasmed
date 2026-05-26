"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/auth-context";
import { updateProfileSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertCircle, CheckCircle2, XCircle, Mail, Phone } from "lucide-react";
import type { UpdateProfileRequest } from "@/types/auth";
import { getInitials, formatDateTime } from "@/lib/utils";
import Link from "next/link";

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your account information and preferences
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.avatarUrl} alt={user.username} />
                <AvatarFallback className="text-lg">
                  {getInitials(user.firstName, user.lastName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold">
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.username}
                </h3>
                <p className="text-sm text-gray-500">@{user.username}</p>
                <div className="mt-2">
                  <Badge variant="secondary">{user.role.name}</Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-700">{user.email}</span>
                  {user.emailVerified ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
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
                  <Phone className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-700">
                    {user.phoneNumber || "No phone number"}
                  </span>
                  {user.phoneNumber &&
                    (user.phoneVerified ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    ))}
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
                <span className="text-gray-500">Account Status:</span>{" "}
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
                <span className="text-gray-500">Member since:</span>{" "}
                <span className="font-medium">
                  {formatDateTime(user.createdAt)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <p>{error}</p>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    {...register("firstName")}
                    disabled={isLoading}
                  />
                  {errors.firstName && (
                    <p className="text-sm text-red-600">
                      {errors.firstName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    {...register("lastName")}
                    disabled={isLoading}
                  />
                  {errors.lastName && (
                    <p className="text-sm text-red-600">
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
                  <p className="text-sm text-red-600">
                    {errors.avatarUrl.message}
                  </p>
                )}
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save changes"}
                </Button>
                <Link href="/dashboard">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4">
              <Link href="/security">
                <Button variant="outline" className="w-full justify-start">
                  Security Settings
                </Button>
              </Link>
              <Link href="/sessions">
                <Button variant="outline" className="w-full justify-start">
                  Manage Sessions
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
