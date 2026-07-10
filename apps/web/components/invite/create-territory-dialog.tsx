"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { territoriesApi } from "@/lib/api/territories";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";
import type { Territory, TerritoryType } from "@/types/territory";

const createTerritorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  code: z.string().min(1, "Código é obrigatório"),
  parentId: z.string().optional(),
});

type CreateTerritoryFormData = z.infer<typeof createTerritorySchema>;

interface CreateTerritoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  territoryType: "manager_zone" | "patch";
  onTerritoryCreated: (territory: Territory) => void;
}

export function CreateTerritoryDialog({
  open,
  onOpenChange,
  territoryType,
  onTerritoryCreated,
}: CreateTerritoryDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [territoryTypes, setTerritoryTypes] = useState<TerritoryType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [groupingTerritories, setGroupingTerritories] = useState<Territory[]>([]);

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
      // Load territory types
      const fetchTypes = async () => {
        try {
          const { data } = await territoriesApi.listTerritoryTypes();
          setTerritoryTypes(data);
        } catch (err) {
          console.error("Failed to fetch territory types:", err);
        } finally {
          setLoadingTypes(false);
        }
      };

      // Load grouping territories for parent selection
      const fetchGroupingTerritories = async () => {
        try {
          const { data } = await territoriesApi.listGroupingTree();
          setGroupingTerritories(data as Territory[]);
        } catch (err) {
          console.error("Failed to fetch grouping territories:", err);
        }
      };

      fetchTypes();
      fetchGroupingTerritories();
    } else {
      // Reset form when closed
      reset();
      setError(null);
    }
  }, [open, reset]);

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

      const result = await territoriesApi.createTerritory({
        name: data.name,
        code: data.code,
        territoryTypeId,
        parentId: data.parentId || undefined,
        countryCode: "BR",
      });

      // Handle approval request case
      if ("approvalType" in result) {
        setError(
          "Território criado e aguardando aprovação. Você pode usá-lo assim que for aprovado."
        );
        return;
      }

      onTerritoryCreated(result.territory);
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

          <div className="space-y-2">
            <Label htmlFor="parentId">Território Pai (Opcional)</Label>
            <Select
              value={watch("parentId")}
              onValueChange={(value) => setValue("parentId", value)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="parentId">
                <SelectValue placeholder="Selecione um território pai" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nenhum</SelectItem>
                {groupingTerritories.map((territory) => (
                  <SelectItem key={territory.id} value={territory.id}>
                    {territory.name} ({territory.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Para hierarquia de agrupamento (país, região, estado)
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
