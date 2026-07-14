"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { professionalsApi } from "@/lib/api/professionals";
import { getApiErrorMessage } from "@/lib/api/errors";
import { canReadProfessionals, canUpdateProfessionals } from "@/lib/permissions";
import type { ProfessionalProfile, UpdateProfessionalInput } from "@atlasmed/access";
import { ProfessionalProfileForm } from "@/components/professionals/professional-profile-form";
import { LinkedFacilitiesCard } from "@/components/professionals/linked-facilities-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function ProfessionalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const professionalId = params.id;

  const [professional, setProfessional] = useState<ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canRead = user ? canReadProfessionals(user.role.name) : false;
  const canEdit = user ? canUpdateProfessionals(user.role.name) : false;

  const loadProfessional = useCallback(async () => {
    setLoading(true);
    try {
      const data = await professionalsApi.getProfessional(professionalId);
      setProfessional(data);
    } catch (error) {
      toast({
        title: "Erro",
        description: getApiErrorMessage(error, "Falha ao carregar profissional"),
        variant: "destructive",
      });
      setProfessional(null);
    } finally {
      setLoading(false);
    }
  }, [professionalId, toast]);

  useEffect(() => {
    if (user && !canRead) {
      router.replace("/unauthorized");
    }
  }, [user, canRead, router]);

  useEffect(() => {
    if (!canRead) return;
    void loadProfessional();
  }, [canRead, loadProfessional]);

  const handleSaveProfile = async (values: UpdateProfessionalInput) => {
    setSaving(true);
    try {
      const updated = await professionalsApi.updateProfessional(professionalId, values);
      setProfessional(updated);
      toast({ title: "Saved", description: "Professional profile updated" });
    } catch (error) {
      toast({
        title: "Erro",
        description: getApiErrorMessage(error, "Falha ao atualizar profissional"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!canRead) {
    return null;
  }

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-zinc-500">Carregando…</div>
    );
  }

  if (!professional) {
    return (
      <div className="py-10 text-center text-sm text-zinc-500">
        Profissional não encontrado
      </div>
    );
  }

  const displayName =
    professional.fullName?.trim() ||
    `${professional.firstName} ${professional.lastName}`.trim();

  return (
    <>
      <div className="px-6 py-8 border-b border-zinc-100">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/professionals">
                <iconify-icon
                  icon="solar:arrow-left-linear"
                  stroke-width="1.5"
                  className="text-base"
                />
                Voltar
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-medium tracking-tight text-zinc-900">
                {displayName}
              </h1>
              <p className="text-sm text-zinc-500 mt-1">Perfil do profissional</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto w-full">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <ProfessionalProfileForm
            professional={professional}
            canEdit={canEdit}
            saving={saving}
            onSubmit={handleSaveProfile}
          />
          <LinkedFacilitiesCard
            facilities={professional.facilities}
            professionalId={professional.id}
          />
        </div>
      </div>
    </>
  );
}
