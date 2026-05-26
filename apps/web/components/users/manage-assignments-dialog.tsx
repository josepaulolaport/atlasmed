"use client";

import { useCallback, useEffect, useState } from "react";
import { usersApi } from "@/lib/api/users";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import type { User, UserAssignments } from "@/types/auth";

interface ManageAssignmentsDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageAssignmentsDialog({
  user,
  open,
  onOpenChange,
}: ManageAssignmentsDialogProps) {
  const [assignments, setAssignments] = useState<UserAssignments | null>(null);
  const [managers, setManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingManager, setSavingManager] = useState(false);
  const [territoryInput, setTerritoryInput] = useState("");
  const [territoryBusy, setTerritoryBusy] = useState<string | null>(null);

  const isTargetUser = user?.role.name === "USER";

  const loadData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [assignmentsData, usersResponse] = await Promise.all([
        usersApi.getUserAssignments(user.id),
        usersApi.getUsers({ page: 1, limit: 100 }),
      ]);

      setAssignments(assignmentsData);
      setManagers(
        usersResponse.data.filter(
          (u) =>
            (u.role.name === "MANAGER" || u.role.name === "ADMIN") &&
            u.id !== user.id
        )
      );
    } catch {
      toast({
        title: "Error",
        description: "Failed to load assignments",
        variant: "destructive",
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [user, onOpenChange]);

  useEffect(() => {
    if (open && user) {
      setTerritoryInput("");
      loadData();
    } else {
      setAssignments(null);
    }
  }, [open, user, loadData]);

  const handleManagerChange = async (value: string) => {
    if (!user) return;

    const managerId = value === "none" ? null : value;
    setSavingManager(true);
    try {
      await usersApi.assignManager(user.id, managerId);
      await loadData();
      toast({
        title: "Success",
        description: managerId
          ? "Manager assigned successfully"
          : "Manager removed successfully",
        variant: "success",
      });
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to update manager",
        variant: "destructive",
      });
    } finally {
      setSavingManager(false);
    }
  };

  const handleAddTerritory = async () => {
    if (!user) return;

    const territoryId = territoryInput.trim();
    if (!territoryId) {
      toast({
        title: "Invalid territory",
        description: "Territory ID cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setTerritoryBusy("add");
    try {
      await usersApi.assignTerritory(user.id, territoryId);
      setTerritoryInput("");
      await loadData();
      toast({
        title: "Success",
        description: "Territory assigned successfully",
        variant: "success",
      });
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to assign territory",
        variant: "destructive",
      });
    } finally {
      setTerritoryBusy(null);
    }
  };

  const handleRevokeTerritory = async (territoryId: string) => {
    if (!user) return;

    setTerritoryBusy(territoryId);
    try {
      await usersApi.revokeTerritory(user.id, territoryId);
      await loadData();
      toast({
        title: "Success",
        description: "Territory revoked successfully",
        variant: "success",
      });
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to revoke territory",
        variant: "destructive",
      });
    } finally {
      setTerritoryBusy(null);
    }
  };

  const formatManagerLabel = (m: User) => {
    const name =
      m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.username;
    return `${name} (${m.email})`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage assignments</DialogTitle>
          <DialogDescription>
            {user
              ? `Organizational scope for ${user.username} (${user.email})`
              : "Loading..."}
          </DialogDescription>
        </DialogHeader>

        {loading || !assignments || !user ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {isTargetUser && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Operational status:</span>
                {assignments.isOperationallyActive ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="secondary">Unassigned</Badge>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="manager-select">Manager</Label>
              <Select
                value={assignments.managerId ?? "none"}
                onValueChange={handleManagerChange}
                disabled={savingManager}
              >
                <SelectTrigger id="manager-select">
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {formatManagerLabel(manager)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assignments.manager && (
                <p className="text-xs text-gray-500">
                  Current: {assignments.manager.username} ({assignments.manager.email})
                </p>
              )}
            </div>

            {isTargetUser && (
              <div className="space-y-3">
                <Label>Territories</Label>
                {assignments.territories.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No territories assigned. Add a territory ID below.
                  </p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {assignments.territories.map((t) => (
                      <li
                        key={t.territoryId}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <div>
                          <span className="font-mono text-sm">{t.territoryId}</span>
                          <p className="text-xs text-gray-500">
                            Assigned {new Date(t.assignedAt).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevokeTerritory(t.territoryId)}
                          disabled={territoryBusy !== null}
                          aria-label={`Remove ${t.territoryId}`}
                        >
                          {territoryBusy === t.territoryId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-red-600" />
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder="Territory ID"
                    value={territoryInput}
                    onChange={(e) => setTerritoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTerritory();
                      }
                    }}
                    disabled={territoryBusy !== null}
                  />
                  <Button
                    onClick={handleAddTerritory}
                    disabled={territoryBusy !== null || !territoryInput.trim()}
                  >
                    {territoryBusy === "add" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
