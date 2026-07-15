'use client'

import * as TabsPrimitive from '@radix-ui/react-tabs'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center rounded-lg bg-zinc-100 p-1 text-zinc-500',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 font-medium text-sm ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-zinc-950 data-[state=active]:shadow-sm',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export const Tabs = TabsPrimitive.Root

export interface TabItem {
  value: string
  label: string
  badge?: string
  badgeVariant?: 'info' | 'muted'
}

interface TabBarProps {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function TabBar({ items, value, onChange, className }: TabBarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-6 overflow-x-auto border-zinc-200 border-b px-6',
        className
      )}
      style={{ scrollbarWidth: 'none' }}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex h-12 items-center gap-2 whitespace-nowrap border-b-2 font-medium text-sm transition-colors',
              active
                ? 'border-blue-500 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            )}
          >
            {item.label}
            {item.badge && (
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-xs',
                  item.badgeVariant === 'info'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-zinc-100 text-zinc-600'
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
