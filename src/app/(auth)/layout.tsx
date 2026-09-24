export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#faf7f2] px-4 py-12">
      {children}
    </div>
  )
}
