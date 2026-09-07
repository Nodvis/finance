import { useTranslations } from "next-intl";

import { SignOutButton } from "./SignOutButton";

export function NoHouseholdCard({ email }: { email?: string }) {
  const t = useTranslations("Auth");

  return (
    <div className="rounded-2xl border border-stone-800 bg-stone-900/80 p-6 shadow-xs backdrop-blur-xs">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-100">
            {t("noHouseholdTitle")}
          </h2>
          <p className="mt-1 text-sm text-stone-400">
            {t("noHouseholdDescription")}
          </p>
          {email && (
            <p className="mt-2 text-xs font-mono text-stone-400">
              {t("signedInAs")}: {email}
            </p>
          )}
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}
