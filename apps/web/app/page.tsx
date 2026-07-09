import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  const features = [
    {
      icon: "solar:shield-check-linear",
      title: "Segurança corporativa",
      description:
        "Criptografia de nível bancário, gerenciamento de sessões e autenticação multifator",
    },
    {
      icon: "solar:users-group-two-linear",
      title: "Gerenciamento de usuários",
      description:
        "Administração completa de usuários com controle de acesso baseado em funções",
    },
    {
      icon: "solar:pulse-linear",
      title: "Monitoramento do sistema",
      description: "Verificações de saúde em tempo real e painel de métricas de desempenho",
    },
    {
      icon: "solar:check-circle-linear",
      title: "Verificação",
      description:
        "Verificação de email e telefone para maior segurança da conta",
    },
  ];

  const trustPoints = [
    "Controle de acesso baseado em funções",
    "Registro de auditoria e conformidade",
    "Gerenciamento de sessões",
    "Monitoramento de saúde em tempo real",
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
                <Button variant="ghost">Entrar</Button>
              </Link>
              <Link href="/register">
                <Button variant="primary">Começar</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main>
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-medium tracking-tight text-zinc-900 sm:text-5xl">
              Operações Comerciais em Saúde
              <span className="block text-blue-600 mt-2">De Forma Simples</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-500">
              Uma plataforma segura e moderna para profissionais de saúde
              gerenciarem usuários, acompanharem atividades e manterem a saúde do
              sistema.
            </p>
            <div className="mt-10 flex justify-center gap-3">
              <Link href="/register">
                <Button size="lg" variant="primary">
                  Comece agora
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  Entrar
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
                    A confiança dos profissionais de saúde
                  </h2>
                  <p className="mt-4 text-sm text-zinc-500">
                    O AtlasMed oferece uma solução completa para gerenciar
                    operações de saúde com segurança de nível corporativo e
                    recursos de conformidade.
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
                        Comece hoje mesmo
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-10 text-white">
                  <h3 className="text-xl font-medium tracking-tight">
                    Pronto para começar?
                  </h3>
                  <p className="mt-4 text-sm text-blue-100">
                    Junte-se às organizações de saúde que já usam o AtlasMed para
                    otimizar suas operações.
                  </p>
                  <div className="mt-8 space-y-6">
                    <div>
                      <div className="text-3xl font-medium tracking-tight">
                        99.9%
                      </div>
                      <div className="text-xs text-blue-100 mt-1">
                        SLA de disponibilidade
                      </div>
                    </div>
                    <div>
                      <div className="text-3xl font-medium tracking-tight">
                        24/7
                      </div>
                      <div className="text-xs text-blue-100 mt-1">
                        Suporte disponível
                      </div>
                    </div>
                    <div>
                      <div className="text-3xl font-medium tracking-tight">
                        HIPAA
                      </div>
                      <div className="text-xs text-blue-100 mt-1">
                        Plataforma em conformidade
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
            <p>&copy; AtlasMed 2026. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
