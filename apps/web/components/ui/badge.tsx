import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 font-medium text-xs transition-colors',
  {
    variants: {
      variant: {
        default: 'border-zinc-200 bg-zinc-100 text-zinc-700',
        secondary: 'border-zinc-200 bg-zinc-100 text-zinc-600',
        info: 'border-blue-100 bg-blue-50 text-blue-700',
        success: 'border-emerald-100 bg-emerald-50 text-emerald-700',
        warning: 'border-amber-100 bg-amber-50 text-amber-700',
        destructive: 'border-red-100 bg-red-50 text-red-700',
        purple: 'border-purple-200 bg-purple-50 text-purple-700',
        outline: 'border-zinc-200 text-zinc-700',
        solid: 'border-transparent bg-zinc-900 text-white'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
