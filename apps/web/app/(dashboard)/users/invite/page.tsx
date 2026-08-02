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
import { TerritorySelector } from "@/components/invite/territory-selector";

export default function InviteUserPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [verticals, setVerticals] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [inviteVerticalId, setInviteVerticalId] = useState("");
  const [territoryId, setTerritoryId] = useState<string | undefined>();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<InviteUserRequest>({
    resolver: zodResolver(inviteUserSchema),
  });

  const watchedRoleId = watch("roleId");

  useEffect(() => {
    if (currentUser && !canManageUsers(currentUser.role.name)) {
      router.push("/unauthorized");
      return;
    }

    const fetchRoles = async () => {
      try {
        const [rolesData, verticalList] = await Promise.all([
          usersApi.getRoles(),
          usersApi.getVerticals(),
        ]);
        setRoles(rolesData);
        setVerticals(verticalList);
        setInviteVerticalId((current) => current || verticalList[0]?.id || "");
      } catch {
        toast({
          title: "Erro",
          description: "Falha ao carregar funções",
          variant: "destructive",
        });
      } finally {
        setLoadingRoles(false);
      }
    };

    fetchRoles();
  }, [currentUser, router]);

  useEffect(() => {
    setSelectedRoleId(watchedRoleId || "");
    setTerritoryId(undefined);
  }, [watchedRoleId]);

  const getSelectedRole = (): RoleInfo | undefined => {
    return roles.find((r) => r.id === selectedRoleId);
  };

  const onSubmit = async (data: InviteUserRequest) => {
    setIsLoading(true);
    setError(null);

    const role = getSelectedRole();
    if (!role) {
      setError("Selecione uma função");
      setIsLoading(false);
      return;
    }

    if ((role.name === "MANAGER" || role.name === "REP") && !territoryId) {
      setError(
        role.name === "MANAGER"
          ? "Zona do gerente é obrigatória"
          : "Área (patch) livre é obrigatória",
      );
      setIsLoading(false);
      return;
    }

    if ((role.name === "MANAGER" || role.name === "REP" || role.name === "OPS") && !inviteVerticalId) {
      setError("Vertical é obrigatória");
      setIsLoading(false);
      return;
    }

    try {
      const payload: InviteUserRequest = {
        email: data.email,
        phoneNumber: data.phoneNumber,
        roleId: data.roleId,
        firstName: data.firstName,
        lastName: data.lastName,
        birthDate: data.birthDate,
        ...(role.name !== "ADMIN"
          ? {
              verticalAssignments: [
                {
                  verticalId: inviteVerticalId,
                  territoryIds: territoryId ? [territoryId] : [],
                },
              ],
            }
          : {}),
      };
      await usersApi.inviteUser(payload);
      toast({
        title: "Sucesso",
        description: "Convite enviado com sucesso",
      });
      router.push("/users/invites");
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || "Falha ao enviar convite");
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser || !canManageUsers(currentUser.role.name)) {
    return null;
  }

  const selectedRole = getSelectedRole();
  const showManagerFields = selectedRole?.name === "MANAGER";
  const showRepFields = selectedRole?.name === "REP";
  const showVertical = showManagerFields || showRepFields || selectedRole?.name === "OPS";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link href="/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900">
          Convidar usuário
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          O vínculo com gerente passa pela zona/área territorial (sem FK de gerente).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do convite</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nome *</Label>
                <Input id="firstName" {...register("firstName")} disabled={isLoading} />
                {errors.firstName && (
                  <p className="text-sm text-red-600">{errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Sobrenome *</Label>
                <Input id="lastName" {...register("lastName")} disabled={isLoading} />
                {errors.lastName && (
                  <p className="text-sm text-red-600">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" {...register("email")} disabled={isLoading} />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Telefone</Label>
                <Input id="phoneNumber" {...register("phoneNumber")} disabled={isLoading} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate">Data de nascimento *</Label>
              <Input
                id="birthDate"
                type="date"
                {...register("birthDate")}
                disabled={isLoading}
              />
              {errors.birthDate && (
                <p className="text-sm text-red-600">{errors.birthDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="roleId">Função *</Label>
              <select
                id="roleId"
                className="flex h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                {...register("roleId")}
                disabled={isLoading || loadingRoles}
              >
                <option value="">Selecione uma função</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              {errors.roleId && (
                <p className="text-sm text-red-600">{errors.roleId.message}</p>
              )}
            </div>

            {showVertical && verticals.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="invite-vertical">Vertical</Label>
                <select
                  id="invite-vertical"
                  value={inviteVerticalId}
                  onChange={(e) => {
                    setInviteVerticalId(e.target.value);
                    setTerritoryId(undefined);
                  }}
                  disabled={isLoading}
                  className="flex h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                >
                  {verticals.map((vertical) => (
                    <option key={vertical.id} value={vertical.id}>
                      {vertical.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showManagerFields && (
              <TerritorySelector
                value={territoryId}
                onChange={setTerritoryId}
                territoryType="manager_zone"
                verticalId={inviteVerticalId}
                disabled={isLoading || !inviteVerticalId}
                required
              />
            )}

            {showRepFields && (
              <TerritorySelector
                value={territoryId}
                onChange={setTerritoryId}
                territoryType="patch"
                verticalId={inviteVerticalId}
                disabled={isLoading || !inviteVerticalId}
                required
              />
            )}

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isLoading || loadingRoles}>
                {isLoading ? "Enviando..." : "Enviar convite"}
              </Button>
              <Link href="/users">
                <Button type="button" variant="outline" disabled={isLoading}>
                  Cancelar
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
