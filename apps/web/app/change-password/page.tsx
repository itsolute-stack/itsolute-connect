import { redirect } from "next/navigation";
import { prisma } from "@itsolute/db";
import { getSession } from "@/lib/session";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export const metadata = { title: "Change password · ITSolute Connect" };

// Top-level route (outside the dashboard/admin layouts) so the forced-change
// guard, which redirects here, doesn't loop.
export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { mustChangePassword: true, email: true },
  });
  const forced = user?.mustChangePassword ?? false;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card p-6">
        <h1 className="text-lg font-semibold">{forced ? "Set a new password" : "Change your password"}</h1>
        <p className="mt-1 mb-5 text-sm text-[var(--color-ink-soft)]">
          {forced
            ? "For security, you need to choose a new password before continuing."
            : "Update the password for your account."}
          {user?.email ? ` (${user.email})` : ""}
        </p>
        <ChangePasswordForm forced={forced} />
      </div>
    </div>
  );
}
