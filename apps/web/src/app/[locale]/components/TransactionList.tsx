import { useTranslations } from "next-intl";

import type { HouseholdAccountSummary } from "@nodvis/finance-db";
import { formatAmountPresentation } from "@/lib/transactions/presentation";
import type { SerializedTransaction } from "@/lib/transactions/schema";

type TransactionListProps = {
  transactions: SerializedTransaction[];
  accounts: HouseholdAccountSummary[];
  locale: string;
};

export function TransactionList({
  transactions,
  accounts,
  locale,
}: TransactionListProps) {
  const t = useTranslations("Transactions");

  const accountMap = new Map(accounts.map((acc) => [acc.id, acc]));

  const formatDate = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
      }).format(new Date(isoString));
    } catch {
      return isoString.split("T")[0] ?? isoString;
    }
  };

  const formatAmount = (amountMinorStr: string, currency: string) => {
    return formatAmountPresentation(amountMinorStr, currency, locale);
  };

  return (
    <section
      aria-label={t("list.title")}
      className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900"
    >
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
            {t("list.title")}
          </h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {t("list.description")}
          </p>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700 dark:bg-stone-800 dark:text-stone-300">
          {transactions.length}
        </span>
      </header>

      {transactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 py-12 px-6 text-center dark:border-stone-700">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="mt-3 text-base font-medium text-stone-900 dark:text-stone-100">
            {t("list.emptyTitle")}
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500 dark:text-stone-400">
            {t("list.emptyDescription")}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs font-medium uppercase tracking-wider text-stone-500 dark:border-stone-800 dark:text-stone-400">
                <th scope="col" className="pb-3 pr-4">
                  {t("list.colDate")}
                </th>
                <th scope="col" className="pb-3 px-4">
                  {t("list.colType")}
                </th>
                <th scope="col" className="pb-3 px-4">
                  {t("list.colDescription")}
                </th>
                <th scope="col" className="pb-3 px-4">
                  {t("list.colAccount")}
                </th>
                <th scope="col" className="pb-3 pl-4 text-right">
                  {t("list.colAmount")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {transactions.map((tx) => {
                let badgeClass = "";
                let typeLabel = "";
                let description = "";
                let accountLabel = "";
                let amountSign = "";
                let amountClass = "";

                if (tx.kind === "expense") {
                  badgeClass =
                    "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200";
                  typeLabel = t("list.kindExpense");
                  description = tx.payee;
                  const acc = accountMap.get(tx.accountId);
                  accountLabel = acc ? acc.name : tx.accountId;
                  amountSign = "- ";
                  amountClass = "text-rose-600 dark:text-rose-400";
                } else if (tx.kind === "income") {
                  badgeClass =
                    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200";
                  typeLabel = t("list.kindIncome");
                  description = tx.source;
                  const acc = accountMap.get(tx.accountId);
                  accountLabel = acc ? acc.name : tx.accountId;
                  amountSign = "+ ";
                  amountClass = "text-emerald-600 dark:text-emerald-400";
                } else {
                  // transfer
                  badgeClass =
                    "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200";
                  typeLabel = t("list.kindTransfer");
                  const fromAcc = accountMap.get(tx.fromAccountId);
                  const toAcc = accountMap.get(tx.toAccountId);
                  const fromName = fromAcc ? fromAcc.name : tx.fromAccountId;
                  const toName = toAcc ? toAcc.name : tx.toAccountId;
                  description = `${fromName} → ${toName}`;
                  accountLabel = `${fromName} → ${toName}`;
                  amountSign = "";
                  amountClass = "text-stone-900 dark:text-stone-100";
                }

                return (
                  <tr key={tx.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30">
                    <td className="py-3 pr-4 text-stone-600 dark:text-stone-400 whitespace-nowrap">
                      {formatDate(tx.occurredOn)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                      >
                        {typeLabel}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-stone-900 dark:text-stone-100">
                      {description}
                    </td>
                    <td className="py-3 px-4 text-stone-500 dark:text-stone-400 whitespace-nowrap">
                      {accountLabel}
                    </td>
                    <td className="py-3 pl-4 text-right whitespace-nowrap">
                      <span className={`font-semibold ${amountClass}`}>
                        {amountSign}
                        {formatAmount(
                          tx.amount.amountMinor,
                          tx.amount.currency,
                        )}
                      </span>
                      <span className="block text-[11px] text-stone-400">
                        {tx.amount.amountMinor} minor units
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
