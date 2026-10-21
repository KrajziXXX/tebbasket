import { useId } from 'react'
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = (p: P) => ({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...p })

export const HangerIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 6.5a2 2 0 1 1 2-2" />
    <path d="M12 6.5v1.2L2.8 15.2A1.5 1.5 0 0 0 3.8 18h16.4a1.5 1.5 0 0 0 1-2.8L12 7.7" />
  </svg>
)
export const PodiumIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M8.5 21V11h7v10M2 21v-6h6.5M15.5 21v-4H22v4M1 21h22" />
    <path d="m12 3 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2L8.8 5.3 11 5z" fill="currentColor" />
  </svg>
)
export const ShopIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 9.5 4.5 4h15L21 9.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z" />
    <path d="M4.5 12v8h15v-8M9.5 20v-5h5v5" />
  </svg>
)
export const GearIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
)
export const CloseIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)
export const PauseIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 5v14M15 5v14" strokeWidth={3} />
  </svg>
)
export const LockIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)
export const PlusIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" strokeWidth={3} />
  </svg>
)

export const CoinIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <circle cx="12" cy="12" r="10" fill="#f5b82e" stroke="#b9801a" strokeWidth="2" />
    <circle cx="12" cy="12" r="6.5" fill="none" stroke="#ffe08a" strokeWidth="1.5" />
    <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="800" fill="#9a6410" fontFamily="Barlow Condensed, sans-serif">C</text>
  </svg>
)
export const GemIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <path d="M6 3h12l4 6-10 12L2 9z" fill="#2ecc71" stroke="#1b8a4a" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M2 9h20M9 3l3 18 3-18M6 3l3 6M18 3l-3 6" fill="none" stroke="#a8f0c6" strokeWidth="1" />
  </svg>
)
export const BallIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="29" fill="#f08a24" stroke="#3a2412" strokeWidth="3" />
    <path d="M32 3v58M3 32h58M12 12c10 10 10 30 0 40M52 12c-10 10-10 30 0 40" fill="none" stroke="#3a2412" strokeWidth="3" />
  </svg>
)

export const Jersey = ({
  jersey, jersey2, pattern = 'none', trim, shorts, number, label = 'TEB', className,
}: {
  jersey: string; jersey2?: string; pattern?: string; trim: string; shorts: string; number: number; label?: string; className?: string
}) => {
  const id = useId().replace(/:/g, '')
  const c2 = jersey2 ?? trim
  const body = 'M14 4h9c1.5 6 16.5 6 18 0h9c-1 7 0 12 5 15v29H9V19c5-3 6-8 5-15Z'
  return (
    <svg viewBox="0 0 64 80" className={className}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={jersey} />
          <stop offset="1" stopColor={pattern === 'gradient' ? c2 : jersey} />
        </linearGradient>
        <clipPath id={`c${id}`}>
          <path d={body} />
        </clipPath>
      </defs>
      <path d={body} fill={`url(#g${id})`} />
      <g clipPath={`url(#c${id})`}>
        {pattern === 'stripes' && Array.from({ length: 9 }, (_, i) => <rect key={i} x={10 + i * 5.5} y="0" width="1.6" height="50" fill={c2} />)}
        {pattern === 'sash' && <rect x="-10" y="22" width="90" height="8" fill={c2} transform="rotate(-35 32 26)" />}
        {pattern === 'stars' &&
          [[18, 22], [44, 18], [30, 30], [16, 40], [48, 38], [36, 44], [24, 12]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.3" fill={c2} />)}
        <rect x="9" y="0" width="9" height="50" fill="rgba(0,0,0,0.12)" />
      </g>
      <path d={body} fill="none" stroke="#2b2320" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M23 4c1.5 7 16.5 7 18 0" fill="none" stroke={trim} strokeWidth="2.5" />
      <path d="M8 48h48l3 26H36l-4-8-4 8H5Z" fill={shorts} stroke="#2b2320" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M54 50l3 22M10 50l-3 22" stroke={trim} strokeWidth="2.5" />
      <text x="32" y="24" textAnchor="middle" fontSize="8" fontWeight="800" fill={trim} fontFamily="Barlow Condensed, sans-serif">{label}</text>
      <text x="32" y="42" textAnchor="middle" fontSize="17" fontWeight="800" fill={trim} stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" fontFamily="Barlow Condensed, sans-serif">{number}</text>
    </svg>
  )
}
