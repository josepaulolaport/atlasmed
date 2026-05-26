import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Shield, Users, CheckCircle2 } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">AtlasMed</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main>
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Healthcare Management
              <span className="block text-blue-600">Made Simple</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
              A secure, modern platform for healthcare professionals to manage
              users, track activities, and maintain system health.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Link href="/register">
                <Button size="lg">Start Now</Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-24 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <Shield className="h-8 w-8 text-blue-600" />
                <CardTitle className="mt-4">Enterprise Security</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Bank-level encryption, session management, and multi-factor
                  authentication
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-8 w-8 text-blue-600" />
                <CardTitle className="mt-4">User Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Comprehensive user administration with role-based access control
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Activity className="h-8 w-8 text-blue-600" />
                <CardTitle className="mt-4">System Monitoring</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Real-time health checks and performance metrics dashboard
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CheckCircle2 className="h-8 w-8 text-blue-600" />
                <CardTitle className="mt-4">Verification</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Email and phone verification for enhanced account security
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-24">
            <Card className="overflow-hidden">
              <div className="grid md:grid-cols-2">
                <div className="p-12">
                  <h2 className="text-3xl font-bold text-gray-900">
                    Trusted by Healthcare Professionals
                  </h2>
                  <p className="mt-4 text-gray-600">
                    AtlasMed provides a comprehensive solution for managing
                    healthcare operations with enterprise-grade security and
                    compliance features.
                  </p>
                  <ul className="mt-6 space-y-3">
                    {[
                      "Role-based access control",
                      "Audit logging and compliance",
                      "Session management",
                      "Real-time health monitoring",
                    ].map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    <Link href="/register">
                      <Button size="lg">Get Started Today</Button>
                    </Link>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-12 text-white">
                  <h3 className="text-2xl font-bold">Ready to get started?</h3>
                  <p className="mt-4">
                    Join healthcare organizations already using AtlasMed to
                    streamline their operations.
                  </p>
                  <div className="mt-8 space-y-4">
                    <div>
                      <div className="text-4xl font-bold">99.9%</div>
                      <div className="text-blue-100">Uptime SLA</div>
                    </div>
                    <div>
                      <div className="text-4xl font-bold">24/7</div>
                      <div className="text-blue-100">Support Available</div>
                    </div>
                    <div>
                      <div className="text-4xl font-bold">HIPAA</div>
                      <div className="text-blue-100">Compliant Platform</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center text-gray-600">
            <p>&copy; 2026 AtlasMed. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
