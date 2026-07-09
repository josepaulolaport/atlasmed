"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { cn, getInitials } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  canManageUsers,
  canReadFacilities,
  canReadProfessionals,
  canReadTerritories,
  canViewHealth,
  hasMinimumRole,
} from "@/lib/permissions";

type NavItem = {
  name: string;
  href: string;
  icon: string;
  badge?: string;
  badgeVariant?: "info" | "muted";
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user || !user.role) return null;

  const roleName = user.role.name;

  const overview: NavItem[] = [
    { name: "Painel", href: "/dashboard", icon: "solar:widget-linear" },
    ...(hasMinimumRole(roleName, "MANAGER")
      ? [
          {
            name: "Sugestões de cadastro",
            href: "/registry-suggestions",
            icon: "solar:inbox-in-linear",
          } as NavItem,
        ]
      : []),
  ];

  const directory: NavItem[] = [
    ...(canReadFacilities(roleName)
      ? [{ name: "Unidades de saúde", href: "/facilities", icon: "solar:buildings-linear" } as NavItem]
      : []),
    ...(canReadProfessionals(roleName)
      ? [
          {
            name: "Profissionais",
            href: "/professionals",
            icon: "solar:stethoscope-linear",
          } as NavItem,
        ]
      : []),
    ...(canReadTerritories(roleName)
      ? [{ name: "Territórios", href: "/territories", icon: "solar:map-point-linear" } as NavItem]
      : []),
  ];

  const administration: NavItem[] = [
    ...(hasMinimumRole(roleName, "MANAGER")
      ? [
          {
            name: "Ingestão de cadastro",
            href: "/registry-suggestions",
            icon: "solar:database-linear",
          } as NavItem,
        ]
      : []),
    ...(canManageUsers(roleName)
      ? [
          {
            name: "Usuários e funções",
            href: "/users",
            icon: "solar:users-group-two-linear",
          } as NavItem,
        ]
      : []),
    ...(canViewHealth(roleName)
      ? [
          {
            name: "Conformidade",
            href: "/health",
            icon: "solar:shield-check-linear",
          } as NavItem,
        ]
      : []),
  ];

  const groups: NavGroup[] = [
    { label: "Visão geral", items: overview },
    { label: "Diretório", items: directory },
    { label: "Administração", items: administration },
  ].filter((g) => g.items.length > 0);

  const displayName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.username;

  return (
    <aside className="hidden md:flex flex-col w-64 bg-zinc-50 border-r border-zinc-200 h-full flex-shrink-0">
      <div className="h-14 flex items-center px-5 border-b border-zinc-200">
        <Link
          href="/dashboard"
          className="text-base font-semibold tracking-tighter text-zinc-900"
        >
          ATLASMED
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {groups.map((group) => (
          <div key={group.label}>
            <h3 className="px-2 text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
              {group.label}
            </h3>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname?.startsWith(item.href + "/"));
                return (
                  <Link
                    key={item.name + item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between px-2 py-1.5 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "text-blue-600 bg-blue-50/50"
                        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <iconify-icon
                        icon={item.icon}
                        stroke-width="1.5"
                        className="text-base"
                      />
                      {item.name}
                    </span>
                    {item.badge && (
                      <span
                        className={cn(
                          "inline-flex items-center justify-center text-xs font-medium rounded-full h-5 px-1.5",
                          item.badgeVariant === "muted"
                            ? "bg-zinc-100 text-zinc-600"
                            : "bg-blue-100 text-blue-700"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-zinc-200">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-zinc-100 transition-colors text-left">
              <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600 text-sm font-medium flex-shrink-0">
                {getInitials(user.firstName, user.lastName) || user.username?.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 truncate">
                  {displayName}
                </p>
                <p className="text-xs text-zinc-500 truncate">
                  {roleName}
                </p>
              </div>
              <iconify-icon
                icon="solar:alt-arrow-up-linear"
                stroke-width="1.5"
                className="text-zinc-400"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                <p className="text-xs leading-none text-zinc-500">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">Perfil</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/sessions">Sessões</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/security">Segurança</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
