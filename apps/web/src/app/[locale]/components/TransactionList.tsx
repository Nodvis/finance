import { useTranslations } from "next-intl";

import type {
  HouseholdAccountSummary,
  HouseholdCategorySummary,
} from "@nodvis/finance-db";
import { formatAmountPresentation } from "@/lib/transactions/presentation";
import type { SerializedTransaction } from "@/lib/transactions/schema";

type TransactionListProps = {
  transactions: SerializedTransaction[];
  accounts: HouseholdAccountSummary[];
  categories?: HouseholdCategorySummary[];
  locale: string;
};

export function TransactionList({
  transactions,
  accounts,
  categories = [],
  locale,
}: TransactionListProps) {
  const t = useTranslations("Transactions");

  const accountMap = new Map(accounts.map((acc) => [acc.id, acc]));
  const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));

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
      className="rounded-2xl border border-stone-800 bg-stone-900/80 p-6 shadow-xs backdrop-blur-xs"
    >
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-100">
            {t("list.title")}
          </h2>
          <p className="mt-1 text-sm text-stone-400">
            {t("list.description")}
          </p>
        </div>
        <span className="rounded-full border border-stone-800 bg-stone-950 px-3 py-1 font-mono text-xs font-semibold text-stone-300">
          {transactions.length}
        </span>
      </header>

      {transactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-800 bg-stone-950/40 py-12 px-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-stone-800 bg-stone-900 text-stone-400">
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
          <h3 className="mt-3 text-base font-medium text-stone-200">
            {t("list.emptyTitle")}
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-stone-400">
            {t("list.emptyDescription")}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-800 text-xs font-medium uppercase tracking-wider text-stone-400">
                <th scope="col" className="pb-3 pr-4">
                  {t("list.colDate")}
                </th>
                <th scope="col" className="pb-3 px-4">
                  {t("list.colType")}
                </th>
                <th scope="col" className="pb-3 px-4">
                  {t("list.colCategory")}
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
            <tbody className="divide-y divide-stone-800/80">
              {transactions.map((tx) => {
                let badgeClass = "";
                let typeLabel = "";
                let description = "";
                let accountLabel = "";
                let amountSign = "";
                let amountClass = "";

                if (tx.kind === "expense") {
                  badgeClass =
                    "bg-rose-950/70 text-rose-300 border border-rose-800/50";
                  typeLabel = t("list.kindExpense");
                  description = tx.payee;
                  const acc = accountMap.get(tx.accountId);
                  accountLabel = acc ? acc.name : tx.accountId;
                  amountSign = "- ";
                  amountClass = "text-rose-400 font-mono";
                } else if (tx.kind === "income") {
                  badgeClass =
                    "bg-emerald-950/70 text-emerald-300 border border-emerald-800/50";
                  typeLabel = t("list.kindIncome");
                  description = tx.source;
                  const acc = accountMap.get(tx.accountId);
                  accountLabel = acc ? acc.name : tx.accountId;
                  amountSign = "+ ";
                  amountClass = "text-emerald-400 font-mono";
                } else {
                  // transfer
                  badgeClass =
                    "bg-sky-950/70 text-sky-300 border border-sky-800/50";
                  typeLabel = t("list.kindTransfer");
                  const fromAcc = accountMap.get(tx.fromAccountId);
                  const toAcc = accountMap.get(tx.toAccountId);
                  const fromName = fromAcc ? fromAcc.name : tx.fromAccountId;
                  const toName = toAcc ? toAcc.name : tx.toAccountId;
                  description = `${fromName} → ${toName}`;
                  accountLabel = `${fromName} → ${toName}`;
                  amountSign = "";
                  amountClass = "text-stone-100 font-mono";
                }

                return (
                  <tr key={tx.id} className="hover:bg-stone-800/30 transition-colors">
                    <td className="py-3 pr-4 text-stone-400 whitespace-nowrap">
                      {formatDate(tx.occurredOn)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                      >
                        {typeLabel}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-stone-300">
                      {tx.kind !== "transfer" && "categoryId" in tx && tx.categoryId ? (
                        <span className="inline-flex items-center rounded-md border border-stone-700 bg-stone-800/60 px-2 py-0.5 text-xs text-stone-200">
                          {categoryMap.get(tx.categoryId)?.name ?? tx.categoryId}
                        </span>
                      ) : (
                        <span className="text-stone-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-stone-100">
                      {description}
                    </td>
                    <td className="py-3 px-4 text-stone-400 whitespace-nowrap">
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
