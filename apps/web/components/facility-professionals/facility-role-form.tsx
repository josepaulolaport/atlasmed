"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { FacilityProfessionalRole, UpdateFacilityProfessionalInput } from "@atlasmed/access";
import { updateFacilityProfessionalFormSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type FacilityRoleFormValues = UpdateFacilityProfessionalInput;

interface FacilityRoleFormProps {
  association: FacilityProfessionalRole;
  canEdit: boolean;
  saving?: boolean;
  onSubmit: (values: FacilityRoleFormValues) => Promise<void>;
}

function toFormValues(association: FacilityProfessionalRole): FacilityRoleFormValues {
  return {
    isPartner: association.isPartner,
    isPrescriber: association.isPrescriber,
    isBuyer: association.isBuyer,
    isDecisionMaker: association.isDecisionMaker,
    relationshipLevel: association.relationshipLevel ?? null,
    specialtyLabel: association.specialtyLabel ?? null,
    notes: association.notes ?? null,
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-600">{message}</p>;
}

function RoleSwitch({
  id,
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border px-4 py-3">
      <Label htmlFor={id}>{label}</Label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function FacilityRoleForm({
  association,
  canEdit,
  saving = false,
  onSubmit,
}: FacilityRoleFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FacilityRoleFormValues>({
    resolver: zodResolver(updateFacilityProfessionalFormSchema),
    defaultValues: toFormValues(association),
  });

  useEffect(() => {
    reset(toFormValues(association));
  }, [association, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Facility roles</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Controller
            name="isPartner"
            control={control}
            render={({ field }) => (
              <RoleSwitch
                id="isPartner"
                label="Partner"
                checked={field.value ?? false}
                disabled={!canEdit}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Controller
            name="isPrescriber"
            control={control}
            render={({ field }) => (
              <RoleSwitch
                id="isPrescriber"
                label="Prescriber"
                checked={field.value ?? false}
                disabled={!canEdit}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Controller
            name="isBuyer"
            control={control}
            render={({ field }) => (
              <RoleSwitch
                id="isBuyer"
                label="Buyer"
                checked={field.value ?? false}
                disabled={!canEdit}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Controller
            name="isDecisionMaker"
            control={control}
            render={({ field }) => (
              <RoleSwitch
                id="isDecisionMaker"
                label="Decision maker"
                checked={field.value ?? false}
                disabled={!canEdit}
                onCheckedChange={field.onChange}
              />
            )}
          />

          <div>
            <Label htmlFor="relationshipLevel">Relationship level</Label>
            <Controller
              name="relationshipLevel"
              control={control}
              render={({ field }) => (
                <Select
                  disabled={!canEdit}
                  value={field.value ?? "none"}
                  onValueChange={(value) =>
                    field.onChange(value === "none" ? null : value)
                  }
                >
                  <SelectTrigger id="relationshipLevel">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.relationshipLevel?.message} />
          </div>

          <div>
            <Label htmlFor="specialtyLabel">Facility specialty label</Label>
            <Input id="specialtyLabel" disabled={!canEdit} {...register("specialtyLabel")} />
            <FieldError message={errors.specialtyLabel?.message} />
          </div>

          <div>
            <Label htmlFor="associationNotes">Association notes</Label>
            <Textarea id="associationNotes" disabled={!canEdit} {...register("notes")} />
            <FieldError message={errors.notes?.message} />
          </div>
        </CardContent>
        {canEdit && (
          <CardFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save facility roles"}
            </Button>
          </CardFooter>
        )}
      </Card>
    </form>
  );
}
