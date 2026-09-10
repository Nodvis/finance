import { sql } from "drizzle-orm";
import { transactions } from "../schema/transactions";
import { liabilityRepayments } from "../schema/liabilities";

// A repayment describes allocation of an existing cash event, not another
// expense. Only explicitly known interest and fees are economic spending.
// An entirely unknown allocation stays unknown instead of becoming zero or
// the full payment amount.
const repaymentWhere = sql`
  ${liabilityRepayments.householdId} = ${transactions.householdId}
  and ${liabilityRepayments.transactionId} = ${transactions.id}
  and ${liabilityRepayments.currency} = ${transactions.currency}
  and ${liabilityRepayments.amountMinor} = ${transactions.amountMinor}
  and ${liabilityRepayments.voidedAt} is null`;

const hasRepayment = sql`exists (select 1 from ${liabilityRepayments} where ${repaymentWhere})`;
const allocation = sql`(
  select case
    when bool_or(${liabilityRepayments.principalMinor} is not null or ${liabilityRepayments.interestMinor} is not null or ${liabilityRepayments.feeMinor} is not null)
    then sum(coalesce(${liabilityRepayments.interestMinor}, 0) + coalesce(${liabilityRepayments.feeMinor}, 0))
    else null
  end
  from ${liabilityRepayments}
  where ${repaymentWhere}
)`;

export const economicAmountMinor = sql`
  case
    when ${hasRepayment} then ${allocation}
    when ${transactions.kind} = 'transfer' then 0
    else ${transactions.amountMinor}
  end
`;
export const economicKind = sql<"expense" | "income">`case when ${transactions.kind} = 'income' then 'income' else 'expense' end`;
