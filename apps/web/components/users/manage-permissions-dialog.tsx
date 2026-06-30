"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import { grantPermissionSchema } from "@/lib/validators";
import type { AccessGrant, User } from "@/types/auth";
import { z } from "zod";

type GrantForm = z.infer<typeof grantPermissionSchema>;

interface ManagePermissionsDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RESOURCES = [
  "USER",
  "FACILITY",
  "PROFESSIONAL",
  "VISIT",
  "TERRITORY",
  "INVITATION",
] as const;
const ACTIONS = ["create", "read", "update", "delete", "manage"] as const;

export function ManagePermissionsDialog({
  user,
  open,
  onOpenChange,
}: ManagePermissionsDialogProps) {
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const form = useForm<GrantForm>({
    resolver: zodResolver(grantPermissionSchema),
    defaultValues: {
      resource: "USER",
      action: "read",
    },
  });

  const loadGrants = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await usersApi.getUserCapabilities(user.id);
      setGrants(data.grants);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load permissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open && user) {
      loadGrants();
    }
  }, [open, user, loadGrants]);

  const handleGrant = async (data: GrantForm) => {
    if (!user) return;

    try {
      await usersApi.grantPermission(user.id, {
        resource: data.resource,
        action: data.action,
        resourceId: data.resourceId || undefined,
        expiresAt: data.expiresAt || undefined,
      });
      toast({
        title: "Success",
        description: "Permission granted",
        variant: "success",
      });
      form.reset({ resource: data.resource, action: data.action });
      await loadGrants();
    } catch (err) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast({
        title: "Error",
        description: error.response?.data?.error?.message || "Failed to grant permission",
        variant: "destructive",
      });
    }
  };

  const handleRevoke = async (grant: AccessGrant) => {
    if (!user) return;

    setRevokingId(grant.id);
    try {
      await usersApi.revokePermission(user.id, {
        resource: grant.resource,
        action: grant.action,
        resourceId: grant.resourceId,
      });
      toast({
        title: "Success",
        description: "Permission revoked",
        variant: "success",
      });
      await loadGrants();
    } catch {
      toast({
        title: "Error",
        description: "Failed to revoke permission",
        variant: "destructive",
      });
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage permissions</DialogTitle>
          <DialogDescription>
            Grant or revoke exceptional access for {user?.username}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Current grants</Label>
              {grants.length === 0 ? (
                <p className="text-sm text-gray-500">No additional grants beyond role defaults.</p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto">
                  {grants.map((grant) => (
                    <li
                      key={grant.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div>
                        <Badge variant="secondary" className="mr-2">
                          {grant.action}
                        </Badge>
                        <span className="font-medium">{grant.resource}</span>
                        {grant.resourceId && (
                          <span className="text-gray-500"> ({grant.resourceId})</span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRevoke(grant)}
                        disabled={revokingId === grant.id}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <form onSubmit={form.handleSubmit(handleGrant)} className="space-y-4 border-t pt-4">
              <Label>Grant new permission</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Resource</Label>
                  <Select
                    value={form.watch("resource")}
                    onValueChange={(value) =>
                      form.setValue("resource", value as GrantForm["resource"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOURCES.map((resource) => (
                        <SelectItem key={resource} value={resource}>
                          {resource}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Action</Label>
                  <Select
                    value={form.watch("action")}
                    onValueChange={(value) =>
                      form.setValue("action", value as GrantForm["action"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIONS.map((action) => (
                        <SelectItem key={action} value={action}>
                          {action}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Resource ID (optional, for scoped grants)</Label>
                <Input placeholder="Leave empty for global grant" {...form.register("resourceId")} />
              </div>
              <Button type="submit" className="w-full">
                Grant permission
              </Button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
