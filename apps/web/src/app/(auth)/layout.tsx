import { AuthBrandPanel } from "./AuthBrandPanel";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-stretch justify-center bg-white lg:justify-start">
      <AuthBrandPanel />
      <div className="flex flex-1 items-center justify-center px-4 py-10">{children}</div>
    </main>
  );
}
