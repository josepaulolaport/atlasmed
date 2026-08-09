"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { professionalsApi } from "@/lib/api/professionals";
import { facilitiesApi } from "@/lib/api/facilities";
import { getApiErrorMessage } from "@/lib/api/errors";
import { canManageProfessionals, canReadProfessionals } from "@/lib/permissions";
import type { Facility, Professional } from "@/types/facility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export default function ProfessionalsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formSpecialty, setFormSpecialty] = useState("");
  const [formFacilityIds, setFormFacilityIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const canRead = user ? canReadProfessionals(user.role.name) : false;
  const canManage = user ? canManageProfessionals(user.role.name) : false;

  useEffect(() => {
    if (user && !canRead) {
      router.replace("/unauthorized");
    }
  }, [user, canRead, router]);

  useEffect(() => {
    if (!canRead) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [professionalsResponse, facilitiesResponse] = await Promise.all([
          professionalsApi.getProfessionals({
            page,
            limit: 10,
            search: search || undefined,
          }),
          facilitiesApi.getFacilities({ limit: 100 }),
        ]);

        setProfessionals(professionalsResponse.data);
        setTotalPages(professionalsResponse.pagination.totalPages);
        setFacilities(facilitiesResponse.data);
      } catch (error) {
        toast({
          title: "Erro",
          description: getApiErrorMessage(error, "Falha ao carregar profissionais"),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [page, search, refreshKey, canRead]);

  const facilityNameById = (facilityId: string) =>
    facilities.find((facility) => facility.id === facilityId)?.name ?? facilityId;

  const openCreateDialog = () => {
    setEditingProfessional(null);
    setFormFirstName("");
    setFormLastName("");
    setFormSpecialty("");
    setFormFacilityIds([]);
    setDialogOpen(true);
  };

  const openEditDialog = (professional: Professional) => {
    setEditingProfessional(professional);
    setFormFirstName(professional.firstName);
    setFormLastName(professional.lastName);
    setFormSpecialty(professional.specialty ?? professional.primarySpecialtyLabel ?? "");
    setFormFacilityIds(professional.facilityIds.map(String));
    setDialogOpen(true);
  };

  const toggleFacilitySelection = (facilityId: string) => {
    setFormFacilityIds((current) =>
      current.includes(facilityId)
        ? current.filter((id) => id !== facilityId)
        : [...current, facilityId]
    );
  };

  const handleSave = async () => {
    if (!formFirstName.trim() || !formLastName.trim()) {
      toast({
        title: "Validation",
        description: "First and last name are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingProfessional) {
        await professionalsApi.updateProfessional(editingProfessional.id, {
          firstName: formFirstName.trim(),
          lastName: formLastName.trim(),
          primarySpecialtyLabel: formSpecialty.trim() || null,
        });
        toast({ title: "Sucesso", description: "Profissional atualizado" });
        setDialogOpen(false);
        setRefreshKey((value) => value + 1);
      } else {
        const created = await professionalsApi.createProfessional({
          firstName: formFirstName.trim(),
          lastName: formLastName.trim(),
          primarySpecialtyLabel: formSpecialty.trim() || undefined,
          facilityIds: formFacilityIds.map(Number),
        });
        toast({ title: "Sucesso", description: "Profissional criado" });
        setDialogOpen(false);
        router.push(`/professionals/${created.id}`);
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: getApiErrorMessage(error, "Falha ao salvar profissional"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (professional: Professional) => {
    if (!confirm(`Excluir ${professional.firstName} ${professional.lastName}?`)) return;

    try {
      await professionalsApi.deleteProfessional(professional.id);
      toast({ title: "Sucesso", description: "Profissional excluído" });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      toast({
        title: "Erro",
        description: getApiErrorMessage(error, "Falha ao excluir profissional"),
        variant: "destructive",
      });
    }
  };

  if (!canRead) {
    return null;
  }

  return (
    <>
      <div className="px-6 py-8 border-b border-zinc-100">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-zinc-900">
              Profissionais
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Gerenciar profissionais e atribuições de unidades
            </p>
          </div>
          {canManage && (
            <Button variant="primary" onClick={openCreateDialog}>
              <iconify-icon
                icon="solar:add-circle-linear"
                stroke-width="1.5"
                className="text-base"
              />
              Adicionar profissional
            </Button>
          )}
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
                placeholder="Buscar profissionais..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="py-10 text-center text-sm text-zinc-500">
                Carregando…
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Especialidade</TableHead>
                      <TableHead>Unidades de saúde</TableHead>
                      {canManage && (
                        <TableHead className="w-[120px]">Ações</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {professionals.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={canManage ? 4 : 3}
                          className="text-center text-sm text-zinc-500 py-10"
                        >
                          Nenhum profissional encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      professionals.map((professional) => (
                        <TableRow key={professional.id}>
                          <TableCell className="font-medium">
                            <Link
                              href={`/professionals/${professional.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {professional.firstName} {professional.lastName}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {professional.specialty ||
                              professional.primarySpecialtyLabel ||
                              "—"}
                          </TableCell>
                          <TableCell>
                            {professional.facilityIds
                              .map((id) => facilityNameById(String(id)))
                              .join(", ") || "—"}
                          </TableCell>
                          {canManage && (
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(professional)}
                                >
                                  <iconify-icon
                                    icon="solar:pen-linear"
                                    stroke-width="1.5"
                                    className="text-base"
                                  />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(professional)}
                                >
                                  <iconify-icon
                                    icon="solar:trash-bin-trash-linear"
                                    stroke-width="1.5"
                                    className="text-base text-red-600"
                                  />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                <div className="mt-4 flex items-center justify-between">
                  <Button
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-zinc-500">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Próximo
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProfessional ? "Editar profissional" : "Criar profissional"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="professional-first-name">Nome</Label>
              <Input
                id="professional-first-name"
                value={formFirstName}
                onChange={(event) => setFormFirstName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="professional-last-name">Sobrenome</Label>
              <Input
                id="professional-last-name"
                value={formLastName}
                onChange={(event) => setFormLastName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="professional-specialty">Especialidade</Label>
              <Input
                id="professional-specialty"
                value={formSpecialty}
                onChange={(event) => setFormSpecialty(event.target.value)}
              />
            </div>
            {!editingProfessional && (
              <div className="space-y-2">
                <Label>Unidades de saúde (opcional)</Label>
                <p className="text-xs text-zinc-500">
                  Deixe sem seleção para criar sem vínculos de unidade. Associe
                  depois na página de uma unidade.
                </p>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-zinc-200 bg-white p-3">
                  {facilities.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      Nenhuma unidade disponível
                    </p>
                  ) : (
                    facilities.map((facility) => (
                      <label
                        key={facility.id}
                        className="flex items-center gap-2 text-sm text-zinc-700"
                      >
                        <input
                          type="checkbox"
                          checked={formFacilityIds.includes(facility.id)}
                          onChange={() => toggleFacilitySelection(facility.id)}
                        />
                        {facility.name}
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
