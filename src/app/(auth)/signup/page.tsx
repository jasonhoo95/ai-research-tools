"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import {
  AuthCard,
  AuthDivider,
  AuthEmailInput,
  AuthPrimaryButton,
  SocialAuthButtons,
} from "@/components/auth/auth-card"
import { signupSchema, type SignupValues } from "@/lib/auth-schema"
import { startGoogleLogin } from "@/lib/auth-client"

export default function SignupPage() {
  const [step, setStep] = React.useState<"email" | "details">("email")
  const [message, setMessage] = React.useState<string | null>(null)

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      terms: false as unknown as true,
    },
    mode: "onTouched",
  })

  const email = form.watch("email")

  const handleSocial = (provider: string) => {
    if (provider === "google") {
      // Google sign-in creates the account on first login.
      setMessage("Redirecting to Google…")
      startGoogleLogin()
      return
    }
    setMessage(`Continue with ${provider} is not available yet — please use Google.`)
  }

  const handleEmailContinue = () => {
    const trimmed = email.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setMessage("Please enter a valid email.")
      return
    }
    form.setValue("email", trimmed)
    setStep("details")
    setMessage(null)
  }

  const onSubmit = async (_values: SignupValues) => {
    setMessage("Email sign-up is not available yet — please continue with Google.")
  }

  return (
    <AuthCard
      title="Create your account"
      footerText="Already have an account?"
      footerLinkLabel="Log In"
      footerLinkHref="/login"
    >
      <SocialAuthButtons onProviderClick={handleSocial} />

      <AuthDivider />

      {step === "email" ? (
        <>
          <AuthEmailInput
            value={email}
            onChange={(value) => form.setValue("email", value)}
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
            onChange={(value) => form.setValue("email", value)}
            placeholder="Enter your email"
          />
          <AuthEmailInput
            value={form.watch("name")}
            onChange={(value) => form.setValue("name", value)}
            placeholder="Enter your name"
            type="text"
          />
          {form.formState.errors.name && (
            <p className="text-sm text-red-500">
              {form.formState.errors.name.message}
            </p>
          )}
          <AuthEmailInput
            value={form.watch("password")}
            onChange={(value) => form.setValue("password", value)}
            placeholder="Create a password"
            type="password"
          />
          {form.formState.errors.password && (
            <p className="text-sm text-red-500">
              {form.formState.errors.password.message}
            </p>
          )}
          <AuthEmailInput
            value={form.watch("confirmPassword")}
            onChange={(value) => form.setValue("confirmPassword", value)}
            placeholder="Confirm your password"
            type="password"
          />
          {form.formState.errors.confirmPassword && (
            <p className="text-sm text-red-500">
              {form.formState.errors.confirmPassword.message}
            </p>
          )}
          <label className="flex items-start gap-2 text-sm text-[#6b7280]">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-[#e8e4de] accent-[#ff4b12]"
              checked={!!form.watch("terms")}
              onChange={(e) =>
                form.setValue("terms", e.target.checked as true, {
                  shouldValidate: true,
                })
              }
            />
            <span>
              I agree to the terms of service and privacy policy.
            </span>
          </label>
          {form.formState.errors.terms && (
            <p className="text-sm text-red-500">
              {form.formState.errors.terms.message}
            </p>
          )}
          <AuthPrimaryButton
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Creating account…" : "Create account"}
          </AuthPrimaryButton>
        </form>
      )}

      {message && (
        <p className="mt-4 text-center text-sm text-[#6b7280]">{message}</p>
      )}
    </AuthCard>
  )
}
