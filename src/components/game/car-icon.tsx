import { cn } from '@/lib/utils'

/** Top-down neon bumper car, tinted per livery. */
export function CarIcon({
  color,
  className,
}: {
  color: string
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('size-12', className)}
      style={{ filter: `drop-shadow(0 0 8px ${color})` }}
      aria-hidden
    >
      <circle cx="32" cy="32" r="27" fill="none" stroke={color} strokeWidth="6" />
      <circle cx="32" cy="32" r="22" fill="#14102a" />
      <rect x="20" y="16" width="24" height="30" rx="7" fill={color} />
      <rect x="23" y="38" width="18" height="7" rx="2" fill="#14102a" />
      <circle cx="32" cy="32" r="5" fill="#f4f1ff" />
      <rect x="24" y="15" width="5" height="3" rx="1" fill="#fffbe6" />
      <rect x="35" y="15" width="5" height="3" rx="1" fill="#fffbe6" />
      <circle cx="32" cy="45" r="2.5" fill={color} />
    </svg>
  )
}
