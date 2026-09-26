import { redirect } from "next/navigation";
import { authMode, getOwnerSession, signInWithPassword } from "@/lib/auth/owner";
import { Button } from "@/components/ui/Button";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const { error } = await signInWithPassword(email, password);
  if (error) redirect(`/admin/login?error=${encodeURIComponent(error)}`);
  redirect("/admin");
}

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (await getOwnerSession()) redirect("/admin");
  const mode = authMode();
  const { error } = await searchParams;

  if (mode === "unavailable") {
    return (
      <div className="max-w-md">
        <h1 className="font-display text-3xl">Dashboard not configured</h1>
        <p className="mt-4 text-ink-muted leading-relaxed">
          Owner sign-in requires Supabase Auth (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ADMIN_EMAILS) or,
          for local development only, DEMO_ADMIN_PASSWORD. See docs/SETUP.md.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <h1 className="font-display text-3xl">Owner sign-in</h1>
      {mode === "demo" && (
        <p className="mt-2 text-sm text-champagne-deep">Demo mode: enter the DEMO_ADMIN_PASSWORD from your .env.local.</p>
      )}
      <form action={loginAction} className="mt-8 flex flex-col gap-5 bg-white border border-line rounded-md p-6">
        {mode === "supabase" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input id="email" name="email" type="email" autoComplete="username" required className="field" />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
        </div>
        {typeof error === "string" && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <Button type="submit">Sign in</Button>
      </form>
      <p className="mt-4 text-xs text-ink-muted">There is no public signup. Accounts are created by the owner in Supabase.</p>
    </div>
  );
}
