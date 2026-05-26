"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { usersApi } from "@/lib/api/users";
import { Button } from "@/components/ui/button";
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
import { toast } from "@/hooks/use-toast";
import {
  UserPlus,
  Trash2,
  Mail,
  Phone,
  ArrowLeft,
  Users,
} from "lucide-react";
import type { Invitation, InviteStatus } from "@/types/auth";
import { canManageUsers } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";

const statusVariant: Record<
  InviteStatus,
  "success" | "destructive" | "secondary" | "default"
> = {
  PENDING: "default",
  ACCEPTED: "success",
  EXPIRED: "secondary",
  REVOKED: "destructive",
};

const statusFilters: Array<{ label: string; value?: InviteStatus }> = [
  { label: "All", value: undefined },
  { label: "Pending", value: "PENDING" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Revoked", value: "REVOKED" },
];

export default function InvitationsPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<InviteStatus | undefined>();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && !canManageUsers(currentUser.role.name)) {
      router.push("/unauthorized");
    }
  }, [currentUser, router]);

  useEffect(() => {
    const loadInvitations = async () => {
      setLoading(true);
      try {
        const response = await usersApi.getInvitations({
          page,
          limit: 10,
          status: statusFilter,
        });
        setInvitations(response.data);
        setTotalPages(response.pagination.totalPages);
      } catch {
        toast({
          title: "Error",
          description: "Failed to load invitations",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (currentUser && canManageUsers(currentUser.role.name)) {
      loadInvitations();
    }
  }, [currentUser, page, statusFilter]);

  const handleRevoke = async (inviteId: string) => {
    if (!confirm("Are you sure you want to revoke this invitation?")) {
      return;
    }

    setRevokingId(inviteId);

    try {
      await usersApi.revokeInvite(inviteId);
      toast({
        title: "Success",
        description: "Invitation revoked successfully",
        variant: "success",
      });

      const response = await usersApi.getInvitations({
        page,
        limit: 10,
        status: statusFilter,
      });
      setInvitations(response.data);
      setTotalPages(response.pagination.totalPages);
    } catch {
      toast({
        title: "Error",
        description: "Failed to revoke invitation",
        variant: "destructive",
      });
    } finally {
      setRevokingId(null);
    }
  };

  if (!currentUser || !canManageUsers(currentUser.role.name)) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/users">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Users
            </Button>
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">Invitations</h1>
          <p className="mt-2 text-gray-600">
            View and manage pending and historical user invitations
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/users">
            <Button variant="outline">
              <Users className="mr-2 h-4 w-4" />
              Users
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
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <Button
                key={filter.label}
                variant={statusFilter === filter.value ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStatusFilter(filter.value);
                  setPage(1);
                }}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
          ) : invitations.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              No invitations found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invited By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <div className="space-y-1">
                          {invitation.email && (
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3 text-gray-400" />
                              {invitation.email}
                            </div>
                          )}
                          {invitation.phoneNumber && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Phone className="h-3 w-3 text-gray-400" />
                              {invitation.phoneNumber}
                            </div>
                          )}
                          {!invitation.email && !invitation.phoneNumber && (
                            <span className="text-sm text-gray-500">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{invitation.role.name}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[invitation.status]}>
                          {invitation.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {invitation.invitedBy ? (
                          <div>
                            <div className="font-medium">
                              {invitation.invitedBy.firstName &&
                              invitation.invitedBy.lastName
                                ? `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`
                                : invitation.invitedBy.username}
                            </div>
                            <div className="text-sm text-gray-500">
                              {invitation.invitedBy.email}
                            </div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDateTime(invitation.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDateTime(invitation.expiresAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {invitation.status === "PENDING" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRevoke(invitation.id)}
                            disabled={revokingId === invitation.id}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {revokingId === invitation.id ? "Revoking..." : "Revoke"}
                          </Button>
                        )}
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
  );
}
