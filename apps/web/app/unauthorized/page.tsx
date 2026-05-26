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
          <CardTitle className="text-2xl">Access Denied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-gray-600">
            You don&apos;t have permission to access this page. If you believe this is
            an error, please contact your administrator.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Go Home</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
