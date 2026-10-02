import { redirect } from "next/navigation";
import { authMode, getOwnerSession, signInThrottled } from "@/lib/auth/owner";
import { Button } from "@/components/ui/Button";

/** Fixed wording per code, so a crafted link can't put its own text on this page. */
const ERRORS: Record<string, string> = {
  failed: "Sign-in failed. Check your email and password.",
  rate_limited: "Too many attempts. Wait a few minutes and try again.",
  unavailable: "Admin sign-in is not configured.",
};

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(formData.get("password") ?? "").slice(0, 1024);
  const { error } = await signInThrottled(email, password);
  if (error) redirect(`/admin/login?error=${error}`);
  redirect("/admin");
}

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (await getOwnerSession()) redirect("/admin");
  const mode = authMode();
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

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
        <p className="mt-2 text-sm text-apex-deep">Demo mode: enter the DEMO_ADMIN_PASSWORD from your .env.local.</p>
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
        {message && (
          <p role="alert" className="text-sm text-error">
            {message}
          </p>
        )}
        <Button type="submit">Sign in</Button>
      </form>
      <p className="mt-4 text-xs text-ink-muted">There is no public signup. Accounts are created by the owner in Supabase.</p>
    </div>
  );
}
