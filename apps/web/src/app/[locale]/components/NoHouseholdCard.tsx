import { useTranslations } from "next-intl";

import { SignOutButton } from "./SignOutButton";

export function NoHouseholdCard({ email }: { email?: string }) {
  const t = useTranslations("Auth");

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
            {t("noHouseholdTitle")}
          </h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {t("noHouseholdDescription")}
          </p>
          {email && (
            <p className="mt-2 text-xs text-stone-400">
              {t("signedInAs")}: {email}
            </p>
          )}
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}
