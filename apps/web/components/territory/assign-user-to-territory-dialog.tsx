"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usersApi } from "@/lib/api/users";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { User } from "@/types/auth";
import type { Territory } from "@/types/territory";
import { canAssignUserToTerritoryNode } from "@/lib/territory/assignment-picker-config";

interface AssignUserToTerritoryDialogProps {
  territory: Territory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AssignUserToTerritoryDialog({
  territory,
  open,
  onOpenChange,
  onSuccess,
}: AssignUserToTerritoryDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [saving, setSaving] = useState(false);

  const assignmentHint = useMemo(() => {
    if (territory.territoryType.assignableToUsers) {
      return "Assign field reps to clinic-assignment territory types.";
    }
    return "Assign managers to territory types configured for manager oversight.";
  }, [territory.territoryType]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await usersApi.getUsers({ page: 1, limit: 100, search: search || undefined });
      setUsers(
        response.data.filter(
          (u) =>
            (u.role.name === "USER" || u.role.name === "MANAGER") &&
            canAssignUserToTerritoryNode({
              userRole: u.role.name as "USER" | "MANAGER",
              territory,
            })
        )
      );
    } catch {
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [search, territory]);

  useEffect(() => {
    if (open) {
      setSelectedUserId("");
      void loadUsers();
    }
  }, [open, loadUsers]);

  const handleAssign = async () => {
    if (!selectedUserId) return;

    const selectedUser = users.find((u) => u.id === selectedUserId);
    if (
      selectedUser &&
      !canAssignUserToTerritoryNode({
        userRole: selectedUser.role.name as "USER" | "MANAGER",
        territory,
      })
    ) {
      toast({
        title: "Invalid assignment",
        description: assignmentHint,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await usersApi.assignTerritory(selectedUserId, territory.id);
      toast({ title: "Success", description: "User assigned to territory", variant: "success" });
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast({
        title: "Error",
        description: getApiErrorMessage(err, "Failed to assign user"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign user to {territory.slug}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500">{assignmentHint}</p>
        <div className="space-y-3">
          <div>
            <Label htmlFor="assign-user-search">Search users</Label>
            <Input
              id="assign-user-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or email"
            />
          </div>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="max-h-60 space-y-2 overflow-y-auto">
              {users.map((user) => (
                <label
                  key={user.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border p-2"
                >
                  <input
                    type="radio"
                    name="assign-user"
                    value={user.id}
                    checked={selectedUserId === user.id}
                    onChange={() => setSelectedUserId(user.id)}
                  />
                  <span className="text-sm">
                    {user.firstName} {user.lastName} ({user.role.name})
                  </span>
                </label>
              ))}
              {users.length === 0 && (
                <p className="text-sm text-gray-500">No eligible users found.</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={saving || !selectedUserId}>
            {saving ? "Assigning..." : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
