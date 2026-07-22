import { requireAdminSession } from "@/lib/session";
import { Markdown } from "@/components/admin/Markdown";
import playbook from "@/content/onboarding-playbook.md";

export const metadata = { title: "Onboarding Playbook · Connect Admin" };

export default async function PlaybookPage() {
  await requireAdminSession();
  return (
    <div className="mx-auto max-w-3xl">
      <article className="card px-6 py-6 md:px-8 md:py-8">
        <Markdown source={playbook} />
      </article>
    </div>
  );
}
