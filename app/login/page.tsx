import { FirmMark } from "@/components/icons";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };

/**
 * The only page in the workspace that an anonymous visitor may see.
 *
 * It reads nothing at request time, so it prerenders as a static shell and is
 * there immediately when a session expires mid-task.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <FirmMark className="size-12 rounded-xl text-base" />
          <div>
            <h1 className="font-serif text-[28px] leading-tight font-semibold tracking-[-0.015em]">
              Harlow &amp; Vance
            </h1>
            <p className="mt-1 text-muted">
              Sign in to the firm&rsquo;s matter workspace.
            </p>
          </div>
        </div>

        <LoginForm />

       
      </div>
    </div>
  );
}
