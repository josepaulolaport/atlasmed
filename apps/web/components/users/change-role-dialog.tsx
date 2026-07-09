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
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { RoleInfo, User } from "@/types/auth";

interface ChangeRoleDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export function ChangeRoleDialog({
  user,
  open,
  onOpenChange,
  onUpdated,
}: ChangeRoleDialogProps) {
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await usersApi.getRoles();
      setRoles(data);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load roles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && user) {
      setSelectedRoleId(user.role.id);
      loadRoles();
    }
  }, [open, user, loadRoles]);

  const handleSave = async () => {
    if (!user || !selectedRoleId) return;

    setSaving(true);
    try {
      await usersApi.changeUserRole(user.id, selectedRoleId);
      toast({
        title: "Success",
        description: "User role updated",
        variant: "success",
      });
      onOpenChange(false);
      onUpdated?.();
    } catch (err) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast({
        title: "Error",
        description: error.response?.data?.error?.message || "Failed to change role",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar função</DialogTitle>
          <DialogDescription>
            Atualize a função de {user?.username}. Isso afeta as permissões imediatamente.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a função" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                      {role.description ? ` — ${role.description}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving || !selectedRoleId}>
                {saving ? "Salvando..." : "Salvar função"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
