"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { canManageTerritories, canReadTerritories, isAdmin } from "@/lib/permissions";
import { territoriesApi } from "@/lib/api/territories";
import { getApiErrorMessage } from "@/lib/api/errors";
import { TerritorySubnav } from "@/components/territory/territory-subnav";
import {
  DEFAULT_TERRITORY_TYPE_FLAGS,
  TerritoryTypeFlagsFields,
} from "@/components/territory/territory-type-flags-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Pencil } from "lucide-react";
import type { TerritoryType, TerritoryTypeFlags } from "@/types/territory";

export default function TerritoryTypesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [types, setTypes] = useState<TerritoryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createFlags, setCreateFlags] = useState<TerritoryTypeFlags>(DEFAULT_TERRITORY_TYPE_FLAGS);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFlags, setEditFlags] = useState<TerritoryTypeFlags>(DEFAULT_TERRITORY_TYPE_FLAGS);
  const [editActive, setEditActive] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const canRead = user ? canReadTerritories(user.role.name) : false;
  const canManage = user ? canManageTerritories(user.role.name) : false;
  const userIsAdmin = user ? isAdmin(user.role.name) : false;

  const loadTypes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await territoriesApi.listTerritoryTypes();
      setTypes(response.data);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load territory types",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && !canRead) {
      router.replace("/unauthorized");
    }
  }, [user, canRead, router]);

  useEffect(() => {
    if (canRead) {
      void loadTypes();
    }
  }, [canRead, loadTypes]);

  const resetCreateForm = () => {
    setSlug("");
    setName("");
    setDescription("");
    setCreateFlags(DEFAULT_TERRITORY_TYPE_FLAGS);
  };

  const handleCreate = async () => {
    if (!slug.trim() || !name.trim()) return;
    setSaving(true);
    try {
      await territoriesApi.createTerritoryType({
        slug: slug.trim().toLowerCase(),
        name: name.trim(),
        description: description.trim() || undefined,
        ...createFlags,
      });
      resetCreateForm();
      await loadTypes();
      toast({ title: "Success", description: "Territory type created", variant: "success" });
    } catch (err) {
      toast({
        title: "Error",
        description: getApiErrorMessage(err, "Failed to create territory type"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (type: TerritoryType) => {
    setEditingId(type.id);
    setEditName(type.name);
    setEditDescription(type.description ?? "");
    setEditFlags({
      canHaveBoundary: type.canHaveBoundary,
      assignsClinics: type.assignsClinics,
      assignableToUsers: type.assignableToUsers,
      assignableToManagers: type.assignableToManagers,
      isCountryLevel: type.isCountryLevel,
      blockSiblingOverlap: type.blockSiblingOverlap,
    });
    setEditActive(type.isActive);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleUpdate = async (typeId: string) => {
    setUpdatingId(typeId);
    try {
      await territoriesApi.updateTerritoryType(typeId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        isActive: editActive,
        ...editFlags,
      });
      setEditingId(null);
      await loadTypes();
      toast({ title: "Success", description: "Territory type updated", variant: "success" });
    } catch (err) {
      toast({
        title: "Error",
        description: getApiErrorMessage(err, "Failed to update territory type"),
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  if (!user || !canRead) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Territory types</h1>
        <p className="mt-1 text-sm text-gray-500">
          Types characterize polygons and control assignment behavior. Hierarchy comes from
          geo-linking, not type rules.
        </p>
      </div>

      <TerritorySubnav />

      {userIsAdmin && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="type-slug">Slug</Label>
                <Input id="type-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="type-name">Name</Label>
                <Input id="type-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="type-description">Description</Label>
                <Input
                  id="type-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            <TerritoryTypeFlagsFields
              flags={createFlags}
              onChange={setCreateFlags}
              idPrefix="create"
            />
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create type"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Configured types</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {types.map((type) => {
                const isEditing = editingId === type.id;

                return (
                  <li key={type.id} className="py-4">
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <Label htmlFor={`edit-name-${type.id}`}>Name</Label>
                            <Input
                              id={`edit-name-${type.id}`}
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`edit-description-${type.id}`}>Description</Label>
                            <Input
                              id={`edit-description-${type.id}`}
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                            />
                          </div>
                        </div>
                        <TerritoryTypeFlagsFields
                          flags={editFlags}
                          onChange={setEditFlags}
                          idPrefix={`edit-${type.id}`}
                        />
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editActive}
                            onChange={(e) => setEditActive(e.target.checked)}
                          />
                          Active
                        </label>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => void handleUpdate(type.id)}
                            disabled={updatingId === type.id}
                          >
                            {updatingId === type.id ? "Saving..." : "Save changes"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEditing}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {type.name}{" "}
                            <span className="text-gray-500">({type.slug})</span>
                            {!type.isActive && (
                              <Badge variant="destructive" className="ml-2">
                                inactive
                              </Badge>
                            )}
                          </p>
                          {type.description ? (
                            <p className="text-sm text-gray-500">{type.description}</p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {type.isCountryLevel && (
                              <Badge variant="outline">country level</Badge>
                            )}
                            {type.canHaveBoundary && (
                              <Badge variant="outline">has boundary</Badge>
                            )}
                            {type.assignsClinics && (
                              <Badge variant="outline">assigns clinics</Badge>
                            )}
                            {type.assignableToManagers && (
                              <Badge variant="outline">manager assignable</Badge>
                            )}
                            {type.assignableToUsers && (
                              <Badge variant="outline">user assignable</Badge>
                            )}
                            {type.blockSiblingOverlap && (
                              <Badge variant="outline">blocks sibling overlap</Badge>
                            )}
                          </div>
                        </div>
                        {userIsAdmin && (
                          <Button size="sm" variant="outline" onClick={() => startEditing(type)}>
                            <Pencil className="mr-1 h-4 w-4" />
                            Edit
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
