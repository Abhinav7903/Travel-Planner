import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/brand";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  let user = null;
  try {
    user = await getSessionUser();
  } catch {
    user = null;
  }
  if (user) redirect(params.next?.startsWith("/") ? params.next : "/trips");

  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/trips";

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px] reveal">
            <p className="eyebrow">Welcome back</p>
            <h1 className="display mt-3 text-[2.4rem] leading-[1.05]">A quiet way in.</h1>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
              Enter your email. We&apos;ll send a six-digit code — no password to remember.
            </p>
            <div className="mt-8">
              <LoginForm next={next} />
            </div>
            <p className="mt-8 border-t border-line pt-5 text-[11.5px] leading-relaxed text-ink-faint">
              By continuing you agree to keep trip details shared only with people you invite. New here? The same code
              creates your account.
            </p>
          </div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden border-l border-line bg-[#f1ede2] lg:block">
        <div className="mesh absolute inset-0" />
        <svg className="absolute inset-0 h-full w-full opacity-70" fill="none" viewBox="0 0 700 900" preserveAspectRatio="xMidYMid slice">
          <path d="M-40 610 C 130 520, 260 640, 390 470 S 590 330, 760 400" stroke="#c9c8b4" strokeWidth="1" strokeDasharray="4 6" />
          <path d="M-40 250 C 120 330, 240 180, 400 260 S 610 230, 760 120" stroke="#cfcdbb" strokeWidth="1" strokeDasharray="4 6" />
          <circle cx="392" cy="472" r="5" fill="#1f4d3d" />
          <circle cx="392" cy="472" r="15" stroke="#1f4d3d" strokeWidth="0.8" opacity=".4" />
          <circle cx="190" cy="568" r="4" fill="#b46d4c" />
          <circle cx="556" cy="374" r="4" fill="#8b8e7e" />
        </svg>
        <div className="absolute inset-x-0 bottom-0 p-12">
          <blockquote className="max-w-md">
            <p className="display text-[2.2rem] leading-[1.15] text-ink">
              “The plan should feel like a place you can return to — not a document you survive.”
            </p>
            <footer className="mt-5 flex items-center gap-3 text-[12px] text-ink-soft">
              <span className="h-px w-8 bg-ink-faint/50" />
              A note from the Wayfarer field journal
            </footer>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
