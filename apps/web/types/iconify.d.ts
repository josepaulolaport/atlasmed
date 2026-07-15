import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'iconify-icon': DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          icon: string
          width?: string | number
          height?: string | number
          rotate?: string | number
          flip?: string
          inline?: boolean
          mode?: 'svg' | 'style' | 'bg' | 'mask'
          'stroke-width'?: string | number
        },
        HTMLElement
      >
    }
  }
}
