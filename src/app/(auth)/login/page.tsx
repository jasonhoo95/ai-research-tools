"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import {
  AuthCard,
  AuthDivider,
  AuthEmailInput,
  AuthPrimaryButton,
  SocialAuthButtons,
} from "@/components/auth/auth-card"
import { loginSchema, type LoginValues } from "@/lib/auth-schema"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [password, setPassword] = React.useState("")
  const [message, setMessage] = React.useState<string | null>(null)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  })

  const handleSocial = (provider: string) => {
    setMessage(`Continue with ${provider} is not wired yet.`)
  }

  const handleEmailContinue = () => {
    if (!email.trim()) {
      setMessage("Please enter your email.")
      return
    }
    setShowPassword(true)
    form.setValue("email", email.trim())
    setMessage(null)
  }

  const onSubmit = async (values: LoginValues) => {
    await new Promise((r) => setTimeout(r, 600))
    console.log("login submit", values)
    router.push("/dashboard")
  }

  return (
    <AuthCard
      title="Welcome back!"
      footerText="Don't have an account?"
      footerLinkLabel="Sign Up"
      footerLinkHref="/signup"
    >
      <SocialAuthButtons onProviderClick={handleSocial} />

      <AuthDivider />

      {!showPassword ? (
        <>
          <AuthEmailInput
            value={email}
            onChange={setEmail}
            placeholder="Enter your email"
          />
          <AuthPrimaryButton onClick={handleEmailContinue}>
            Continue with Email
          </AuthPrimaryButton>
        </>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <AuthEmailInput
            value={email}
            onChange={setEmail}
            placeholder="Enter your email"
          />
          <AuthEmailInput
            value={password}
            onChange={(value) => {
              setPassword(value)
              form.setValue("password", value)
            }}
            placeholder="Enter your password"
            type="password"
          />
          {form.formState.errors.password && (
            <p className="text-sm text-red-500">
              {form.formState.errors.password.message}
            </p>
          )}
          <AuthPrimaryButton
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Signing in…" : "Continue with Email"}
          </AuthPrimaryButton>
        </form>
      )}

      {message && (
        <p className="mt-4 text-center text-sm text-[#6b7280]">{message}</p>
      )}
    </AuthCard>
  )
}
