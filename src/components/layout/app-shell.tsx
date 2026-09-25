"use client"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { AppTopbar } from "@/components/layout/app-topbar"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    // Exactly one screen tall: pages scroll inside the content area (or
    // manage their own scroll regions) instead of growing the window.
    <div className="flex h-screen overflow-hidden bg-white">
      <AppSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppTopbar />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#fcfcfd]">
          {children}
        </div>
      </div>
    </div>
  )
}
