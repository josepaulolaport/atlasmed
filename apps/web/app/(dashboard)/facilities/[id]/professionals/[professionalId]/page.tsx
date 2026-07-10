"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { facilitiesApi } from "@/lib/api/facilities";
import { facilityProfessionalsApi } from "@/lib/api/facility-professionals";
import { professionalsApi } from "@/lib/api/professionals";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  canReadFacilities,
  canUpdateFacilities,
  canUpdateProfessionals,
} from "@/lib/permissions";
import type {
  ProfessionalFacilityContext,
  UpdateFacilityProfessionalInput,
  UpdateProfessionalInput,
} from "@atlasmed/access";
import { ProfessionalProfileForm } from "@/components/professionals/professional-profile-form";
import { FacilityRoleForm } from "@/components/facility-professionals/facility-role-form";
import { LinkedFacilitiesCard } from "@/components/professionals/linked-facilities-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

export default function FacilityProfessionalRegistrationPage() {
  const params = useParams<{ id: string; professionalId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const facilityId = params.id;
  const professionalId = params.professionalId;

  const [facilityName, setFacilityName] = useState("");
  const [context, setContext] = useState<ProfessionalFacilityContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);

  const canRead = user ? canReadFacilities(user.role.name) : false;
  const canEditProfile = user ? canUpdateProfessionals(user.role.name) : false;
  const canEditRoles = user ? canUpdateFacilities(user.role.name) : false;

  const loadContext = useCallback(async () => {
    setLoading(true);
    try {
      const [facility, registrationContext] = await Promise.all([
        facilitiesApi.getFacility(facilityId),
        facilityProfessionalsApi.getContext(facilityId, professionalId),
      ]);
      setFacilityName(facility.name);
      setContext(registrationContext);
    } catch (error) {
      toast({
        title: "Erro",
        description: getApiErrorMessage(error, "Falha ao carregar contexto de cadastro"),
        variant: "destructive",
      });
      setContext(null);
    } finally {
      setLoading(false);
    }
  }, [facilityId, professionalId, toast]);

  useEffect(() => {
    if (user && !canRead) {
      router.replace("/unauthorized");
    }
  }, [user, canRead, router]);

  useEffect(() => {
    if (!canRead) return;
    void loadContext();
  }, [canRead, loadContext]);

  const handleSaveProfile = async (values: UpdateProfessionalInput) => {
    setSavingProfile(true);
    try {
      const updatedProfessional = await professionalsApi.updateProfessional(
        professionalId,
        values
      );
      setContext((current) =>
        current ? { ...current, professional: updatedProfessional } : current
      );
      toast({ title: "Saved", description: "Professional profile updated" });
    } catch (error) {
      toast({
        title: "Erro",
        description: getApiErrorMessage(error, "Falha ao atualizar perfil do profissional"),
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveRoles = async (values: UpdateFacilityProfessionalInput) => {
    setSavingRoles(true);
    try {
      const updatedAssociation = await facilityProfessionalsApi.updateRoles(
        facilityId,
        professionalId,
        values
      );
      setContext((current) =>
        current ? { ...current, association: updatedAssociation } : current
      );
      toast({ title: "Saved", description: "Facility roles updated" });
    } catch (error) {
      toast({
        title: "Erro",
        description: getApiErrorMessage(error, "Falha ao atualizar funções na unidade"),
        variant: "destructive",
      });
    } finally {
      setSavingRoles(false);
    }
  };

  if (!canRead) {
    return null;
  }

  if (loading) {
    return <div className="py-8 text-center text-gray-500">Carregando formulário de cadastro...</div>;
  }

  if (!context) {
    return <div className="py-8 text-center text-gray-500">Contexto de cadastro não encontrado</div>;
  }

  const displayName =
    context.professional.fullName?.trim() ||
    `${context.professional.firstName} ${context.professional.lastName}`.trim();

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/facilities/${facilityId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div>
          <p className="text-sm text-gray-500">
            <Link href="/facilities" className="hover:underline">
              Unidades de saúde
            </Link>
            {" / "}
            <Link href={`/facilities/${facilityId}`} className="hover:underline">
              {facilityName}
            </Link>
          </p>
          <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
          <p className="text-sm text-gray-500">Cadastro do profissional</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <ProfessionalProfileForm
            professional={context.professional}
            canEdit={canEditProfile}
            saving={savingProfile}
            onSubmit={handleSaveProfile}
          />
          <FacilityRoleForm
            association={context.association}
            canEdit={canEditRoles}
            saving={savingRoles}
            onSubmit={handleSaveRoles}
          />
        </div>
        <LinkedFacilitiesCard
          facilities={context.facilities}
          professionalId={professionalId}
        />
      </div>
    </div>
  );
}
