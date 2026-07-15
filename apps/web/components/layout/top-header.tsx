'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment, type ReactNode } from 'react'

type Crumb = {
  label: string
  href?: string
}

const LABEL_MAP: Record<string, string> = {
  dashboard: 'Painel',
  facilities: 'Unidades de saúde',
  professionals: 'Profissionais',
  territories: 'Territórios',
  users: 'Usuários',
  profile: 'Perfil',
  sessions: 'Sessões',
  security: 'Segurança',
  health: 'Saúde do sistema',
  'registry-suggestions': 'Sugestões de cadastro'
}

function humanize(segment: string): string {
  return LABEL_MAP[segment] ?? segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: Crumb[] = []
  let acc = ''
  segments.forEach((seg, idx) => {
    acc += '/' + seg
    const isLast = idx === segments.length - 1
    const isDynamicId = /^[0-9a-f-]{20,}$/i.test(seg) || /^\d+$/.test(seg)
    crumbs.push({
      label: isDynamicId ? 'Detalhe' : humanize(seg),
      href: isLast ? undefined : acc
    })
  })
  return crumbs
}

export interface TopHeaderProps {
  breadcrumbs?: Crumb[]
  actions?: ReactNode
}

export function TopHeader({ breadcrumbs, actions }: TopHeaderProps) {
  const pathname = usePathname() ?? '/'
  const crumbs = breadcrumbs ?? buildCrumbs(pathname)

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-zinc-200 border-b bg-white px-6">
      <nav className="flex items-center gap-2 font-medium text-sm text-zinc-500">
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
                <Link href={crumb.href} className="transition-colors hover:text-zinc-900">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-zinc-900">{crumb.label}</span>
              )}
            </Fragment>
          ))
        )}
      </nav>

      {actions && <div className="flex items-center gap-4">{actions}</div>}
    </header>
  )
}
