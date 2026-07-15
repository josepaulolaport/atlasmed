'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/auth-context'
import {
  canManageUsers,
  canReadFacilities,
  canReadProfessionals,
  canReadTerritories,
  canViewHealth,
  hasMinimumRole
} from '@/lib/permissions'
import { cn, getInitials } from '@/lib/utils'

type NavItem = {
  name: string
  href: string
  icon: string
  badge?: string
  badgeVariant?: 'info' | 'muted'
}

type NavGroup = {
  label: string
  items: NavItem[]
}

export function Sidebar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  if (!user || !user.role) return null

  const roleName = user.role.name

  const overview: NavItem[] = [
    { name: 'Painel', href: '/dashboard', icon: 'solar:widget-linear' },
    ...(hasMinimumRole(roleName, 'MANAGER')
      ? [
          {
            name: 'Sugestões de cadastro',
            href: '/registry-suggestions',
            icon: 'solar:inbox-in-linear'
          } as NavItem
        ]
      : [])
  ]

  const directory: NavItem[] = [
    ...(canReadFacilities(roleName)
      ? [
          {
            name: 'Unidades de saúde',
            href: '/facilities',
            icon: 'solar:buildings-linear'
          } as NavItem
        ]
      : []),
    ...(canReadProfessionals(roleName)
      ? [
          {
            name: 'Profissionais',
            href: '/professionals',
            icon: 'solar:stethoscope-linear'
          } as NavItem
        ]
      : []),
    ...(canReadTerritories(roleName)
      ? [{ name: 'Territórios', href: '/territories', icon: 'solar:map-point-linear' } as NavItem]
      : [])
  ]

  const administration: NavItem[] = [
    ...(canManageUsers(roleName)
      ? [
          {
            name: 'Usuários e funções',
            href: '/users',
            icon: 'solar:users-group-two-linear'
          } as NavItem
        ]
      : []),
    ...(canViewHealth(roleName)
      ? [
          {
            name: 'Conformidade',
            href: '/health',
            icon: 'solar:shield-check-linear'
          } as NavItem
        ]
      : [])
  ]

  const groups: NavGroup[] = [
    { label: 'Visão geral', items: overview },
    { label: 'Diretório', items: directory },
    { label: 'Administração', items: administration }
  ].filter((g) => g.items.length > 0)

  const displayName =
    user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username

  return (
    <aside className="hidden h-full w-64 flex-shrink-0 flex-col border-zinc-200 border-r bg-zinc-50 md:flex">
      <div className="flex h-14 items-center border-zinc-200 border-b px-5">
        <Link href="/dashboard" className="font-semibold text-base text-zinc-900 tracking-tighter">
          ATLASMED
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label}>
            <h3 className="mb-2 px-2 font-medium text-xs text-zinc-400 uppercase tracking-wider">
              {group.label}
            </h3>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname?.startsWith(item.href + '/'))
                return (
                  <Link
                    key={item.name + item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center justify-between rounded-md px-2 py-1.5 font-medium text-sm transition-colors',
                      isActive
                        ? 'bg-blue-50/50 text-blue-600'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <iconify-icon icon={item.icon} stroke-width="1.5" className="text-base" />
                      {item.name}
                    </span>
                    {item.badge && (
                      <span
                        className={cn(
                          'inline-flex h-5 items-center justify-center rounded-full px-1.5 font-medium text-xs',
                          item.badgeVariant === 'muted'
                            ? 'bg-zinc-100 text-zinc-600'
                            : 'bg-blue-100 text-blue-700'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-zinc-200 border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-zinc-100">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-200 font-medium text-sm text-zinc-600">
                {getInitials(user.firstName, user.lastName) ||
                  user.username?.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm text-zinc-900">{displayName}</p>
                <p className="truncate text-xs text-zinc-500">{roleName}</p>
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
                <p className="font-medium text-sm leading-none">{displayName}</p>
                <p className="text-xs text-zinc-500 leading-none">{user.email}</p>
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
  )
}
