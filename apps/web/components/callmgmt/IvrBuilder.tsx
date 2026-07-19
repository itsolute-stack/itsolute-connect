"use client";

import { useActionState } from "react";
import { addIvrNodeAction, deleteIvrNodeAction } from "@/lib/callmgmt-actions";

interface Node {
  id: string;
  parentId: string | null;
  key: string | null;
  prompt: string;
  action: string;
}

const ACTION_LABEL: Record<string, string> = {
  ring_staff: "Ring staff",
  submenu: "Submenu",
  voicemail: "Voicemail",
  hangup: "Hang up",
};

export function IvrBuilder({ nodes }: { nodes: Node[] }) {
  const [state, action, pending] = useActionState(addIvrNodeAction, null as { ok?: boolean; error?: string } | null);
  const roots = nodes.filter((n) => !n.parentId);
  const childrenOf = (id: string) => nodes.filter((n) => n.parentId === id);
  const input =
    "w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-600)]";

  return (
    <div className="space-y-5">
      {nodes.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-faint)]">
          No IVR menu. Without one, calls ring your staff directly. Add a root menu below to greet callers first.
        </p>
      ) : (
        <ul className="space-y-2">
          {roots.map((r) => (
            <TreeNode key={r.id} node={r} childrenOf={childrenOf} depth={0} />
          ))}
        </ul>
      )}

      <form action={action} className="space-y-3 border-t border-[var(--color-line)] pt-4">
        <div className="text-xs font-semibold text-[var(--color-ink-soft)]">Add menu step</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">Parent (blank = root)</label>
            <select name="parentId" className={input} defaultValue="">
              <option value="">— Root menu —</option>
              {nodes
                .filter((n) => n.action === "submenu" || !n.parentId)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.key ? `[${n.key}] ` : ""}
                    {n.prompt.slice(0, 30)}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">DTMF key (for child)</label>
            <input name="key" placeholder="1" maxLength={1} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">Prompt (spoken)</label>
            <input name="prompt" placeholder="Press 1 for bookings, 2 for support" className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">Action</label>
            <select name="action" className={input} defaultValue="ring_staff">
              <option value="ring_staff">Ring staff</option>
              <option value="submenu">Submenu</option>
              <option value="voicemail">Voicemail</option>
              <option value="hangup">Hang up</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button disabled={pending} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
            {pending ? "Adding…" : "Add step"}
          </button>
          {state?.error && <span className="text-sm text-[var(--color-danger-600)]">{state.error}</span>}
        </div>
      </form>
      <p className="text-xs text-[var(--color-ink-faint)]">Actions: {Object.values(ACTION_LABEL).join(" · ")}</p>
    </div>
  );
}

function TreeNode({
  node,
  childrenOf,
  depth,
}: {
  node: Node;
  childrenOf: (id: string) => Node[];
  depth: number;
}) {
  const kids = childrenOf(node.id);
  return (
    <li>
      <div
        className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] px-3 py-2"
        style={{ marginLeft: depth * 20 }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm">
            {node.key && (
              <span className="grid h-5 w-5 place-items-center rounded bg-[var(--color-brand-50)] text-xs font-semibold text-[var(--color-brand-700)]">
                {node.key}
              </span>
            )}
            <span className="truncate font-medium">{node.prompt}</span>
          </div>
          <div className="text-xs text-[var(--color-ink-faint)]">{ACTION_LABEL[node.action] ?? node.action}</div>
        </div>
        <form action={deleteIvrNodeAction}>
          <input type="hidden" name="nodeId" value={node.id} />
          <button className="rounded-lg px-2 py-1 text-xs text-[var(--color-danger-600)] hover:bg-rose-50">Delete</button>
        </form>
      </div>
      {kids.length > 0 && (
        <ul className="mt-2 space-y-2">
          {kids.map((k) => (
            <TreeNode key={k.id} node={k} childrenOf={childrenOf} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
