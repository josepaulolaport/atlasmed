"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { usersApi } from "@/lib/api/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import {
  MoreVertical,
  Search,
  UserPlus,
  CheckCircle2,
  XCircle,
  Ban,
  PlayCircle,
  Pause,
  MapPin,
  Shield,
  UserCog,
} from "lucide-react";
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
          title: "Error",
          description: "Failed to load users",
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

      toast({
        title: "Success",
        description: `User ${action}d successfully`,
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
      toast({
        title: "Error",
        description: error.response?.data?.message || `Failed to ${action} user`,
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="mt-2 text-gray-600">
            Manage users, invitations, and permissions
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/users/invites">
            <Button variant="outline">
              View Invitations
            </Button>
          </Link>
          <Link href="/users/invite">
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite User
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by username or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              No users found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.username}</div>
                          {user.firstName && user.lastName && (
                            <div className="text-sm text-gray-500">
                              {user.firstName} {user.lastName}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
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
                          {user.emailVerified ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                          )}
                          {user.phoneVerified ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {userIsAdmin && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setRoleUser(user);
                                    setRoleOpen(true);
                                  }}
                                >
                                  <UserCog className="mr-2 h-4 w-4" />
                                  Change role
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setPermissionsUser(user);
                                    setPermissionsOpen(true);
                                  }}
                                >
                                  <Shield className="mr-2 h-4 w-4" />
                                  Manage permissions
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setAssignmentsUser(user);
                                    setAssignmentsOpen(true);
                                  }}
                                >
                                  <MapPin className="mr-2 h-4 w-4" />
                                  Manage assignments
                                </DropdownMenuItem>
                              </>
                            )}
                            {userIsAdmin && user.status === "INACTIVE" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleUserAction(user.id, "activate")
                                }
                              >
                                <PlayCircle className="mr-2 h-4 w-4" />
                                Activate
                              </DropdownMenuItem>
                            )}
                            {user.status === "ACTIVE" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleUserAction(user.id, "suspend")
                                  }
                                >
                                  <Pause className="mr-2 h-4 w-4" />
                                  Suspend
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleUserAction(user.id, "deactivate")
                                  }
                                  className="text-red-600"
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  Deactivate
                                </DropdownMenuItem>
                              </>
                            )}
                            {user.status === "SUSPENDED" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleUserAction(user.id, "unsuspend")
                                }
                              >
                                <PlayCircle className="mr-2 h-4 w-4" />
                                Unsuspend
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
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
}
