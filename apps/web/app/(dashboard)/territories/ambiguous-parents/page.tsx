"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { canManageTerritories, canReadTerritories } from "@/lib/permissions";
import { territoriesApi } from "@/lib/api/territories";
import { TerritorySubnav } from "@/components/territory/territory-subnav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { Territory } from "@/types/territory";

export default function AmbiguousParentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);

  const canRead = user ? canReadTerritories(user.role.name) : false;
  const canManage = user ? canManageTerritories(user.role.name) : false;

  const loadTerritories = useCallback(async () => {
    if (!canManage) return;

    setLoading(true);
    try {
      const response = await territoriesApi.listAmbiguousParents();
      setTerritories(response.data);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load ambiguous parent assignments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    if (user && !canRead) {
      router.replace("/unauthorized");
      return;
    }
    if (user && canRead && !canManage) {
      router.replace("/territories");
    }
  }, [user, canRead, canManage, router]);

  useEffect(() => {
    if (canManage) {
      void loadTerritories();
    }
  }, [canManage, loadTerritories]);

  if (!user || !canManage) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Ambiguous parent assignments</h1>
        <p className="mt-1 text-sm text-gray-500">
          Territories whose boundaries overlap multiple parents without a clear geographic winner
        </p>
      </div>

      <TerritorySubnav />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Review queue</CardTitle>
          <Button size="sm" variant="outline" onClick={() => void loadTerritories()}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : territories.length === 0 ? (
            <p className="text-sm text-gray-500">No territories need parent review.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {territories.map((territory) => (
                <li key={territory.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {territory.code} — {territory.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {territory.territoryType.name}
                      {territory.countryCode ? ` · market ${territory.countryCode}` : ""}
                      {!territory.isCountryLevel && territory.slug
                        ? ` · ${territory.slug}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">ambiguous</Badge>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/territories?selected=${territory.id}`}>Review</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
