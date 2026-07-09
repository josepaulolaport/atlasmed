import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  const features = [
    {
      icon: "solar:shield-check-linear",
      title: "Enterprise Security",
      description:
        "Bank-level encryption, session management, and multi-factor authentication",
    },
    {
      icon: "solar:users-group-two-linear",
      title: "User Management",
      description:
        "Comprehensive user administration with role-based access control",
    },
    {
      icon: "solar:pulse-linear",
      title: "System Monitoring",
      description: "Real-time health checks and performance metrics dashboard",
    },
    {
      icon: "solar:check-circle-linear",
      title: "Verification",
      description:
        "Email and phone verification for enhanced account security",
    },
  ];

  const trustPoints = [
    "Role-based access control",
    "Audit logging and compliance",
    "Session management",
    "Real-time health monitoring",
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      <nav className="border-b border-zinc-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <span className="text-lg font-semibold tracking-tighter text-zinc-900">
              ATLASMED
            </span>
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost">Sign in</Button>
              </Link>
              <Link href="/register">
                <Button variant="primary">Get started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main>
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-medium tracking-tight text-zinc-900 sm:text-5xl">
              Healthcare Commercial Operations
              <span className="block text-blue-600 mt-2">Made Simple</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-500">
              A secure, modern platform for healthcare professionals to manage
              users, track activities, and maintain system health.
            </p>
            <div className="mt-10 flex justify-center gap-3">
              <Link href="/register">
                <Button size="lg" variant="primary">
                  Start now
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  Sign in
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-24 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-zinc-200 bg-white shadow-sm p-6"
              >
                <div className="inline-flex items-center justify-center rounded-lg bg-blue-50 p-2.5 text-blue-600">
                  <iconify-icon
                    icon={feature.icon}
                    stroke-width="1.5"
                    className="text-xl"
                  />
                </div>
                <h3 className="mt-4 text-sm font-medium text-zinc-900 tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-zinc-500">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-24">
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="grid md:grid-cols-2">
                <div className="p-10">
                  <h2 className="text-2xl font-medium tracking-tight text-zinc-900">
                    Trusted by Healthcare Professionals
                  </h2>
                  <p className="mt-4 text-sm text-zinc-500">
                    AtlasMed provides a comprehensive solution for managing
                    healthcare operations with enterprise-grade security and
                    compliance features.
                  </p>
                  <ul className="mt-6 space-y-3">
                    {trustPoints.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-3 text-sm"
                      >
                        <iconify-icon
                          icon="solar:check-circle-linear"
                          stroke-width="1.5"
                          className="text-base text-emerald-600"
                        />
                        <span className="text-zinc-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    <Link href="/register">
                      <Button size="lg" variant="primary">
                        Get started today
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-10 text-white">
                  <h3 className="text-xl font-medium tracking-tight">
                    Ready to get started?
                  </h3>
                  <p className="mt-4 text-sm text-blue-100">
                    Join healthcare organizations already using AtlasMed to
                    streamline their operations.
                  </p>
                  <div className="mt-8 space-y-6">
                    <div>
                      <div className="text-3xl font-medium tracking-tight">
                        99.9%
                      </div>
                      <div className="text-xs text-blue-100 mt-1">
                        Uptime SLA
                      </div>
                    </div>
                    <div>
                      <div className="text-3xl font-medium tracking-tight">
                        24/7
                      </div>
                      <div className="text-xs text-blue-100 mt-1">
                        Support Available
                      </div>
                    </div>
                    <div>
                      <div className="text-3xl font-medium tracking-tight">
                        HIPAA
                      </div>
                      <div className="text-xs text-blue-100 mt-1">
                        Compliant Platform
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-center text-xs text-zinc-500">
            <p>&copy; AtlasMed 2026. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
