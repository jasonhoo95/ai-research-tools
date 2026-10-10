"use client"

import axios from "axios"

import type { AuthUser } from "@/lib/auth-session"
import { appApi } from "@/lib/api"
import { clearChatThreads } from "@/store/chat-thread-store"

/** Where to return after login: the ?next= the proxy added, if any. */
export function nextFromLocation(): string | null {
  if (typeof window === "undefined") return null
  return new URLSearchParams(window.location.search).get("next")
}

/** Login error passed back to /login by the auth callback. */
export function loginErrorFromLocation(): string | null {
  if (typeof window === "undefined") return null
  return new URLSearchParams(window.location.search).get("error")
}

/** Full-page redirect into Supabase Google login. */
export function startGoogleLogin(next = nextFromLocation()) {
  // Chats saved for instant opening belong to whoever was signed in before.
  clearChatThreads()
  const url = new URL("/api/auth/google", window.location.origin)
  if (next) url.searchParams.set("next", next)
  window.location.assign(url.toString())
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const { data } = await appApi.get<AuthUser>("/auth/me")
  return data
}

export async function logout() {
  clearChatThreads()
  try {
    await axios.post("/api/auth/logout")
  } finally {
    window.location.assign("/login")
  }
}
