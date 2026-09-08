import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentUserHouseholdsStatus } from "@/lib/authorization/household";
import { listHouseholdAccountsSummary } from "@/lib/accounts/service";
import { serializeAccount } from "@/lib/accounts/serialization";
import { SignInCard } from "../components/SignInCard";
import { NoHouseholdCard } from "../components/NoHouseholdCard";
import { ImportView } from "./ImportView";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ accountId?: string }> };

export default async function ImportsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { accountId } = await searchParams;
  const t = await getTranslations("Imports");
  if (!hasLocale(routing.locales, locale)) notFound();
  const session = await getCurrentSession();
  if (!session) return <div className="mx-auto w-full max-w-6xl px-4 py-8"><SignInCard /></div>;
  const status = await getCurrentUserHouseholdsStatus();
  if (status.status === "none") return <div className="mx-auto w-full max-w-6xl px-4 py-8"><NoHouseholdCard email={session.user.email} defaultDisplayName={session.user.name} /></div>;
  if (status.status !== "single" && status.status !== "multiple_selected") return <div className="mx-auto w-full max-w-6xl px-4 py-8"><p className="text-stone-300">{t("selectHousehold")}</p></div>;
  const context = status.activeContext;
  const accounts = (await listHouseholdAccountsSummary(context)).filter((account) => account.archivedAt === null).map(serializeAccount);
  return <ImportView householdId={context.householdId} accounts={accounts} initialAccountId={accountId} />;
}
