"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, type ReactNode } from "react";

type Crumb = {
  label: string;
  href?: string;
};

const LABEL_MAP: Record<string, string> = {
  dashboard: "Painel",
  facilities: "Unidades de saúde",
  professionals: "Profissionais",
  territories: "Territórios",
  users: "Usuários",
  profile: "Perfil",
  sessions: "Sessões",
  security: "Segurança",
  health: "Saúde do sistema",
  "registry-suggestions": "Sugestões de cadastro",
};

function humanize(segment: string): string {
  return (
    LABEL_MAP[segment] ??
    segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let acc = "";
  segments.forEach((seg, idx) => {
    acc += "/" + seg;
    const isLast = idx === segments.length - 1;
    const isDynamicId =
      /^[0-9a-f-]{20,}$/i.test(seg) || /^\d+$/.test(seg);
    crumbs.push({
      label: isDynamicId ? "Detalhe" : humanize(seg),
      href: isLast ? undefined : acc,
    });
  });
  return crumbs;
}

export interface TopHeaderProps {
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
}

export function TopHeader({ breadcrumbs, actions }: TopHeaderProps) {
  const pathname = usePathname() ?? "/";
  const crumbs = breadcrumbs ?? buildCrumbs(pathname);

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-zinc-200 flex-shrink-0 bg-white">
      <nav className="flex items-center text-sm font-medium text-zinc-500 gap-2">
        {crumbs.length === 0 ? (
          <span className="text-zinc-900">AtlasMed</span>
        ) : (
          crumbs.map((crumb, idx) => (
            <Fragment key={idx}>
              {idx > 0 && (
                <iconify-icon
                  icon="solar:alt-arrow-right-linear"
                  stroke-width="1.5"
                  className="text-zinc-300"
                />
              )}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-zinc-900 transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-zinc-900">{crumb.label}</span>
              )}
            </Fragment>
          ))
        )}
      </nav>

      <div className="flex items-center gap-4">
        <div className="relative hidden sm:block w-64">
          <iconify-icon
            icon="solar:magnifer-linear"
            stroke-width="1.5"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-base"
          />
          <input
            type="text"
            placeholder="Buscar em tudo..."
            className="w-full h-8 pl-8 pr-3 text-sm bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-shadow placeholder:text-zinc-400"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <kbd className="text-xs font-sans text-zinc-400 bg-white border border-zinc-200 rounded px-1">
              ⌘
            </kbd>
            <kbd className="text-xs font-sans text-zinc-400 bg-white border border-zinc-200 rounded px-1">
              K
            </kbd>
          </div>
        </div>
        <div className="w-px h-4 bg-zinc-200 hidden sm:block" />
        {actions ?? (
          <button
            type="button"
            className="text-zinc-400 hover:text-zinc-900 transition-colors relative"
            aria-label="Notificações"
          >
            <iconify-icon
              icon="solar:bell-linear"
              stroke-width="1.5"
              className="text-xl"
            />
            <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white" />
          </button>
        )}
      </div>
    </header>
  );
}
