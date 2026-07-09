import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <ShieldAlert className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl">Acesso negado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-gray-600">
            Você não tem permissão para acessar esta página. Se acredita que isto
            é um erro, entre em contato com o administrador.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/dashboard">
              <Button>Ir para o painel</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Página inicial</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
