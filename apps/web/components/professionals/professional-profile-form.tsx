"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ProfessionalProfile, UpdateProfessionalInput } from "@atlasmed/access";
import { updateProfessionalFormSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type ProfessionalProfileFormValues = UpdateProfessionalInput;

interface ProfessionalProfileFormProps {
  professional: ProfessionalProfile;
  canEdit: boolean;
  saving?: boolean;
  onSubmit: (values: ProfessionalProfileFormValues) => Promise<void>;
}

function toFormValues(professional: ProfessionalProfile): ProfessionalProfileFormValues {
  return {
    firstName: professional.firstName,
    lastName: professional.lastName,
    fullName: professional.fullName ?? null,
    socialName: professional.socialName ?? null,
    taxId: professional.taxId ?? null,
    birthDate: professional.birthDate ?? null,
    mobilePhone: professional.mobilePhone ?? null,
    landlinePhone: professional.landlinePhone ?? null,
    email: professional.email ?? null,
    websiteUrl: professional.websiteUrl ?? null,
    imageUrl: professional.imageUrl ?? null,
    primarySpecialtyLabel: professional.primarySpecialtyLabel ?? null,
    crmCouncil: professional.crmCouncil ?? null,
    crmNumber: professional.crmNumber ?? null,
    crmState: professional.crmState ?? null,
    favoriteTeam: professional.favoriteTeam ?? null,
    favoriteSport: professional.favoriteSport ?? null,
    hobbies: professional.hobbies ?? null,
    notes: professional.notes ?? null,
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-600">{message}</p>;
}

export function ProfessionalProfileForm({
  professional,
  canEdit,
  saving = false,
  onSubmit,
}: ProfessionalProfileFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfessionalProfileFormValues>({
    resolver: zodResolver(updateProfessionalFormSchema),
    defaultValues: toFormValues(professional),
  });

  useEffect(() => {
    reset(toFormValues(professional));
  }, [professional, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Identidade</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="firstName">Nome</Label>
              <Input id="firstName" disabled={!canEdit} {...register("firstName")} />
              <FieldError message={errors.firstName?.message} />
            </div>
            <div>
              <Label htmlFor="lastName">Sobrenome</Label>
              <Input id="lastName" disabled={!canEdit} {...register("lastName")} />
              <FieldError message={errors.lastName?.message} />
            </div>
            <div>
              <Label htmlFor="fullName">Nome completo</Label>
              <Input id="fullName" disabled={!canEdit} {...register("fullName")} />
              <FieldError message={errors.fullName?.message} />
            </div>
            <div>
              <Label htmlFor="socialName">Nome social</Label>
              <Input id="socialName" disabled={!canEdit} {...register("socialName")} />
              <FieldError message={errors.socialName?.message} />
            </div>
            <div>
              <Label htmlFor="taxId">CPF</Label>
              <Input id="taxId" disabled={!canEdit} {...register("taxId")} />
              <FieldError message={errors.taxId?.message} />
            </div>
            <div>
              <Label htmlFor="birthDate">Data de nascimento</Label>
              <Input id="birthDate" type="date" disabled={!canEdit} {...register("birthDate")} />
              <FieldError message={errors.birthDate?.message} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contato</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="mobilePhone">Telefone celular</Label>
              <Input id="mobilePhone" disabled={!canEdit} {...register("mobilePhone")} />
              <FieldError message={errors.mobilePhone?.message} />
            </div>
            <div>
              <Label htmlFor="landlinePhone">Telefone fixo</Label>
              <Input id="landlinePhone" disabled={!canEdit} {...register("landlinePhone")} />
              <FieldError message={errors.landlinePhone?.message} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" disabled={!canEdit} {...register("email")} />
              <FieldError message={errors.email?.message} />
            </div>
            <div>
              <Label htmlFor="websiteUrl">Site</Label>
              <Input id="websiteUrl" disabled={!canEdit} {...register("websiteUrl")} />
              <FieldError message={errors.websiteUrl?.message} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="imageUrl">URL da imagem</Label>
              <Input id="imageUrl" disabled={!canEdit} {...register("imageUrl")} />
              <FieldError message={errors.imageUrl?.message} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">CRM e especialidade</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="crmCouncil">Conselho</Label>
              <Input id="crmCouncil" disabled={!canEdit} {...register("crmCouncil")} />
              <FieldError message={errors.crmCouncil?.message} />
            </div>
            <div>
              <Label htmlFor="crmNumber">Número do CRM</Label>
              <Input id="crmNumber" disabled={!canEdit} {...register("crmNumber")} />
              <FieldError message={errors.crmNumber?.message} />
            </div>
            <div>
              <Label htmlFor="crmState">Estado do CRM</Label>
              <Input id="crmState" maxLength={2} disabled={!canEdit} {...register("crmState")} />
              <FieldError message={errors.crmState?.message} />
            </div>
            <div>
              <Label htmlFor="primarySpecialtyLabel">Especialidade principal</Label>
              <Input
                id="primarySpecialtyLabel"
                disabled={!canEdit}
                {...register("primarySpecialtyLabel")}
              />
              <FieldError message={errors.primarySpecialtyLabel?.message} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preferências e observações</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="favoriteTeam">Time favorito</Label>
              <Input id="favoriteTeam" disabled={!canEdit} {...register("favoriteTeam")} />
              <FieldError message={errors.favoriteTeam?.message} />
            </div>
            <div>
              <Label htmlFor="favoriteSport">Esporte favorito</Label>
              <Input id="favoriteSport" disabled={!canEdit} {...register("favoriteSport")} />
              <FieldError message={errors.favoriteSport?.message} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="hobbies">Passatempos</Label>
              <Textarea id="hobbies" disabled={!canEdit} {...register("hobbies")} />
              <FieldError message={errors.hobbies?.message} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" disabled={!canEdit} {...register("notes")} />
              <FieldError message={errors.notes?.message} />
            </div>
          </CardContent>
          {canEdit && (
            <CardFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar perfil"}
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </form>
  );
}
