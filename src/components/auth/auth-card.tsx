"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#F25022" d="M3 3h8v8H3z" />
      <path fill="#7FBA00" d="M13 3h8v8h-8z" />
      <path fill="#00A4EF" d="M3 13h8v8H3z" />
      <path fill="#FFB900" d="M13 13h8v8h-8z" />
    </svg>
  )
}

type SocialProvider = "google" | "apple" | "microsoft"

const socialConfig: Record<
  SocialProvider,
  { label: string; icon: ReactNode; className: string }
> = {
  google: {
    label: "Continue with Google",
    icon: <GoogleIcon className="size-5" />,
    className:
      "bg-[#ff4b12] text-white hover:bg-[#ea430f] border border-transparent shadow-sm",
  },
  apple: {
    label: "Continue with Apple",
    icon: <AppleIcon className="size-5" />,
    className:
      "bg-white text-[#27272a] hover:bg-[#fafafa] border border-[#e8e4de]",
  },
  microsoft: {
    label: "Continue with Microsoft",
    icon: <MicrosoftIcon className="size-4" />,
    className:
      "bg-white text-[#27272a] hover:bg-[#fafafa] border border-[#e8e4de]",
  },
}

export function AuthCard({
  title,
  children,
  footerText,
  footerLinkLabel,
  footerLinkHref,
}: {
  title: string
  children: ReactNode
  footerText: string
  footerLinkLabel: string
  footerLinkHref: string
}) {
  return (
    <div className="w-full max-w-[420px]">
      <div className="rounded-[24px] border border-[#ece8e2] bg-white px-8 py-10 shadow-[0_8px_40px_rgba(0,0,0,0.04)]">
        <h1 className="mb-8 text-center text-[28px] font-bold tracking-tight text-[#111827]">
          {title}
        </h1>
        {children}
      </div>

      <p className="mt-6 text-center text-sm text-[#6b7280]">
        {footerText}{" "}
        <Link
          href={footerLinkHref}
          className="font-semibold text-[#ff4b12] hover:underline"
        >
          {footerLinkLabel}
        </Link>
      </p>
    </div>
  )
}

export function SocialAuthButtons({
  onProviderClick,
}: {
  onProviderClick?: (provider: SocialProvider) => void
}) {
  return (
    <div className="space-y-3">
      {(Object.keys(socialConfig) as SocialProvider[]).map((provider) => {
        const config = socialConfig[provider]
        return (
          <button
            key={provider}
            type="button"
            onClick={() => onProviderClick?.(provider)}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-3 rounded-full text-sm font-medium transition-colors",
              config.className
            )}
          >
            {config.icon}
            {config.label}
          </button>
        )
      })}
    </div>
  )
}

export function AuthDivider() {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-[#ece8e2]" />
      <span className="text-sm text-[#9ca3af]">Or</span>
      <div className="h-px flex-1 bg-[#ece8e2]" />
    </div>
  )
}

export function AuthEmailInput({
  value,
  onChange,
  placeholder = "Enter your email",
  type = "email",
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-12 w-full rounded-xl border border-[#e8e4de] bg-white px-4 text-sm text-[#27272a] outline-none transition-colors placeholder:text-[#b0b7c3] focus:border-[#ff4b12]/40 focus:ring-2 focus:ring-[#ff4b12]/15"
    />
  )
}

export function AuthPrimaryButton({
  children,
  disabled,
  type = "button",
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  type?: "button" | "submit"
  onClick?: () => void
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="mt-3 flex h-12 w-full items-center justify-center rounded-full bg-[#f8b092] text-sm font-medium text-white transition-colors hover:bg-[#f29b78] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  )
}
