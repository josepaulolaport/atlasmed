"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { territoriesApi } from "@/lib/api/territories";
import { usersApi } from "@/lib/api/users";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";
import { isApprovalRequest } from "@/components/territory/territory-utils";
import type { Territory, TerritoryType } from "@/types/territory";

const createTerritorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  code: z.string().min(1, "Código é obrigatório"),
});

type CreateTerritoryFormData = z.infer<typeof createTerritorySchema>;

interface CreateTerritoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  territoryType: "manager_zone" | "patch";
  /** When set (invite flow), new territory is created under this vertical. */
  verticalId?: string;
  onTerritoryCreated: (territory: Territory) => void;
}

export function CreateTerritoryDialog({
  open,
  onOpenChange,
  territoryType,
  verticalId: verticalIdProp,
  onTerritoryCreated,
}: CreateTerritoryDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [territoryTypes, setTerritoryTypes] = useState<TerritoryType[]>([]);
  const [resolvedVerticalId, setResolvedVerticalId] = useState(verticalIdProp ?? "");
  const [loadingTypes, setLoadingTypes] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<CreateTerritoryFormData>({
    resolver: zodResolver(createTerritorySchema),
  });

  useEffect(() => {
    if (open) {
      const fetchTypes = async () => {
        try {
          const [{ data }, verticals] = await Promise.all([
            territoriesApi.listTerritoryTypes(),
            usersApi.getVerticals(),
          ]);
          setTerritoryTypes(data);
          setResolvedVerticalId(verticalIdProp || verticals[0]?.id || "");
        } catch (err) {
          console.error("Failed to fetch territory types:", err);
        } finally {
          setLoadingTypes(false);
        }
      };

      fetchTypes();
    } else {
      reset();
      setError(null);
    }
  }, [open, reset, verticalIdProp]);

  const getTerritoryTypeId = (): string | undefined => {
    return territoryTypes.find((t) => t.slug === territoryType)?.id;
  };

  const generateCode = (name: string): string => {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "_")
      .substring(0, 20);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    if (!watch("code")) {
      setValue("code", generateCode(name));
    }
  };

  const onSubmit = async (data: CreateTerritoryFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const territoryTypeId = getTerritoryTypeId();
      if (!territoryTypeId) {
        throw new Error("Tipo de território não encontrado");
      }
      if (!resolvedVerticalId) {
        throw new Error("Vertical de negócio não encontrada");
      }

      const result = await territoriesApi.createTerritory({
        name: data.name,
        slug: data.code.toLowerCase(),
        verticalId: resolvedVerticalId,
        territoryTypeId,
      });

      if (isApprovalRequest(result)) {
        setError(
          "Território criado e aguardando aprovação. Você pode usá-lo assim que for aprovado."
        );
        return;
      }

      onTerritoryCreated(result);
      onOpenChange(false);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(
        error.response?.data?.error || "Falha ao criar território"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = territoryType === "manager_zone" 
    ? "Criar Zona de Gerente" 
    : "Criar Território de Representante";

  const description = territoryType === "manager_zone"
    ? "Crie uma nova zona de gerente para atribuir a um gerente"
    : "Crie um novo território de representante (patch) para atribuir a um representante de campo";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">
              Nome <span className="text-red-600">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Ex: Zona Norte"
              {...register("name")}
              onChange={handleNameChange}
              disabled={isSubmitting}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">
              Código <span className="text-red-600">*</span>
            </Label>
            <Input
              id="code"
              placeholder="Ex: ZONA_NORTE"
              {...register("code")}
              disabled={isSubmitting}
            />
            {errors.code && (
              <p className="text-sm text-red-600">{errors.code.message}</p>
            )}
            <p className="text-xs text-gray-500">
              Código único para identificar este território
            </p>
          </div>

          <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700">
            <p className="font-medium">Nota:</p>
            <p className="mt-1">
              A definição de limite (boundary) pode ser configurada posteriormente
              na página de territórios. Não é necessário para atribuição.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting || loadingTypes}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Território"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
