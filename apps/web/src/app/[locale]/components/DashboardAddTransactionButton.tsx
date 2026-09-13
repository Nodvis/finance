"use client";

import { Plus } from "lucide-react";

type Props = { label: string };

export function DashboardAddTransactionButton({ label }: Props) {
  function openForm() {
    const form = document.getElementById("transaction-forms");
    if (form instanceof HTMLDetailsElement) {
      form.open = true;
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return (
    <button
      type="button"
      onClick={openForm}
      className="inline-flex items-center gap-2 rounded-xl bg-[var(--foreground)] px-4 py-2.5 font-semibold text-[var(--surface)] transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--finance-signal-dark)]"
    >
      <Plus size={15} aria-hidden="true" />
      {label}
    </button>
  );
}
