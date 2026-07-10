"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { usersApi } from "@/lib/api/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import type { User } from "@/types/auth";
import { canManageUsers, isAdmin } from "@/lib/permissions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ManageAssignmentsDialog } from "@/components/users/manage-assignments-dialog";
import { ChangeRoleDialog } from "@/components/users/change-role-dialog";
import { ManagePermissionsDialog } from "@/components/users/manage-permissions-dialog";

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [assignmentsUser, setAssignmentsUser] = useState<User | null>(null);
  const [assignmentsOpen, setAssignmentsOpen] = useState(false);
  const [roleUser, setRoleUser] = useState<User | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState<User | null>(null);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const userIsAdmin = currentUser ? isAdmin(currentUser.role.name) : false;

  useEffect(() => {
    if (currentUser && !canManageUsers(currentUser.role.name)) {
      router.push("/unauthorized");
      return;
    }
  }, [currentUser, router]);

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      try {
        const response = await usersApi.getUsers({
          page,
          limit: 10,
          search: search || undefined,
        });
        setUsers(response.data);
        setTotalPages(response.pagination.totalPages);
      } catch {
        toast({
          title: "Erro",
          description: "Falha ao carregar usuários",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [page, search, refreshKey]);

  const handleUserAction = async (
    userId: string,
    action: "activate" | "deactivate" | "suspend" | "unsuspend"
  ) => {
    try {
      switch (action) {
        case "activate":
          await usersApi.activateUser(userId);
          break;
        case "deactivate":
          await usersApi.deactivateUser(userId);
          break;
        case "suspend":
          await usersApi.suspendUser(userId);
          break;
        case "unsuspend":
          await usersApi.unsuspendUser(userId);
          break;
      }

      const actionLabels: Record<string, string> = {
        activate: "ativado",
        deactivate: "desativado",
        suspend: "suspenso",
        unsuspend: "reativado",
      };
      toast({
        title: "Sucesso",
        description: `Usuário ${actionLabels[action] ?? action} com sucesso`,
        variant: "success",
      });

      const response = await usersApi.getUsers({
        page,
        limit: 10,
        search: search || undefined,
      });
      setUsers(response.data);
      setTotalPages(response.pagination.totalPages);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      const actionVerbLabels: Record<string, string> = {
        activate: "ativar",
        deactivate: "desativar",
        suspend: "suspender",
        unsuspend: "reativar",
      };
      toast({
        title: "Erro",
        description: error.response?.data?.message || `Falha ao ${actionVerbLabels[action] ?? action} usuário`,
        variant: "destructive",
      });
    }
  };

  if (!currentUser || !canManageUsers(currentUser.role.name)) {
    return null;
  }

  return (
    <>
      <ManageAssignmentsDialog
        user={assignmentsUser}
        open={assignmentsOpen}
        onOpenChange={(open) => {
          setAssignmentsOpen(open);
          if (!open) setAssignmentsUser(null);
        }}
      />
      <ChangeRoleDialog
        user={roleUser}
        open={roleOpen}
        onOpenChange={(open) => {
          setRoleOpen(open);
          if (!open) setRoleUser(null);
        }}
        onUpdated={() => setRefreshKey((k) => k + 1)}
      />
      <ManagePermissionsDialog
        user={permissionsUser}
        open={permissionsOpen}
        onOpenChange={(open) => {
          setPermissionsOpen(open);
          if (!open) setPermissionsUser(null);
        }}
      />

      <div className="px-6 py-8 border-b border-zinc-100">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-zinc-900">
              Gerenciamento de usuários
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Gerencie usuários, convites e permissões
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/users/invites">
              <Button variant="outline">Ver convites</Button>
            </Link>
            <Link href="/users/invite">
              <Button variant="primary">
                <iconify-icon
                  icon="solar:user-plus-linear"
                  stroke-width="1.5"
                  className="text-base"
                />
                Convidar usuário
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto w-full">
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50">
            <div className="relative max-w-sm">
              <iconify-icon
                icon="solar:magnifer-linear"
                stroke-width="1.5"
                className="text-base absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <Input
                placeholder="Buscar por nome de usuário ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="py-10 text-center text-sm text-zinc-500">
                Carregando…
              </div>
            ) : users.length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-500">
                Nenhum usuário encontrado
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Verificado</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium text-zinc-900">
                              {user.username}
                            </div>
                            {user.firstName && user.lastName && (
                              <div className="text-xs text-zinc-500">
                                {user.firstName} {user.lastName}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-zinc-700">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{user.role.name}</Badge>
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
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
                                  : "text-base text-zinc-400"
                              }
                            />
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
                                  : "text-base text-zinc-400"
                              }
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <iconify-icon
                                  icon="solar:menu-dots-linear"
                                  stroke-width="1.5"
                                  className="text-base"
                                />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {userIsAdmin && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setRoleUser(user);
                                      setRoleOpen(true);
                                    }}
                                  >
                                    <iconify-icon
                                      icon="solar:user-linear"
                                      stroke-width="1.5"
                                      className="text-base mr-2"
                                    />
                                    Alterar função
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setPermissionsUser(user);
                                      setPermissionsOpen(true);
                                    }}
                                  >
                                    <iconify-icon
                                      icon="solar:shield-check-linear"
                                      stroke-width="1.5"
                                      className="text-base mr-2"
                                    />
                                    Gerenciar permissões
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setAssignmentsUser(user);
                                      setAssignmentsOpen(true);
                                    }}
                                  >
                                    <iconify-icon
                                      icon="solar:map-point-linear"
                                      stroke-width="1.5"
                                      className="text-base mr-2"
                                    />
                                    Gerenciar atribuições
                                  </DropdownMenuItem>
                                </>
                              )}
                              {userIsAdmin && user.status === "INACTIVE" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleUserAction(user.id, "activate")
                                  }
                                >
                                  <iconify-icon
                                    icon="solar:play-circle-linear"
                                    stroke-width="1.5"
                                    className="text-base mr-2"
                                  />
                                  Ativar
                                </DropdownMenuItem>
                              )}
                              {user.status === "ACTIVE" && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleUserAction(user.id, "suspend")
                                    }
                                  >
                                    <iconify-icon
                                      icon="solar:pause-circle-linear"
                                      stroke-width="1.5"
                                      className="text-base mr-2"
                                    />
                                    Suspender
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleUserAction(user.id, "deactivate")
                                    }
                                    className="text-red-600"
                                  >
                                    <iconify-icon
                                      icon="solar:forbidden-circle-linear"
                                      stroke-width="1.5"
                                      className="text-base mr-2"
                                    />
                                    Desativar
                                  </DropdownMenuItem>
                                </>
                              )}
                              {user.status === "SUSPENDED" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleUserAction(user.id, "unsuspend")
                                  }
                                >
                                  <iconify-icon
                                    icon="solar:play-circle-linear"
                                    stroke-width="1.5"
                                    className="text-base mr-2"
                                  />
                                  Cancelar suspensão
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Anterior
                    </Button>
                    <span className="text-sm text-zinc-500">
                      Página {page} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                    >
                      Próximo
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
