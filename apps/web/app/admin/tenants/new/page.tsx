import Link from "next/link";
import { requireAdminSession } from "@/lib/session";
import { NewTenantForm } from "@/components/admin/NewTenantForm";

export default async function NewTenantPage() {
  await requireAdminSession();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/admin" className="text-sm font-medium text-[var(--color-brand-700)]">
        ← All tenants
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Add tenant</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Create a business. You can wire its Plivo number and WhatsApp on the next screen.
        </p>
      </div>
      <section className="card p-5">
        <NewTenantForm />
      </section>
    </div>
  );
}
