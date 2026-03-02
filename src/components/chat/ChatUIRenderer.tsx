"use client";

import type { UIComponent, ChatAction } from "@/lib/ui-components";
import type {
  SpendingPieChartData,
  AccountsBarChartData,
  BnplCardData,
  WishlistCardData,
  SavingsGoalsProgressData,
  TransactionsTableData,
  AffordabilityVerdictData,
} from "@/lib/ui-components";
import { SpendingPieChart } from "./SpendingPieChart";
import { AccountsBarChart } from "./AccountsBarChart";
import { BnplCards } from "./BnplCards";
import { WishlistCards } from "./WishlistCards";
import { SavingsGoalsProgress } from "./SavingsGoalsProgress";
import { TransactionsTable } from "./TransactionsTable";
import { AffordabilityVerdict } from "./AffordabilityVerdict";

export function ChatUIRenderer({
  components,
  onAction,
}: {
  components: UIComponent[];
  onAction?: (action: ChatAction) => void;
}) {
  if (!components || components.length === 0) return null;

  return (
    <div className="mt-3 space-y-3">
      {components.map((comp, idx) => {
        switch (comp.type) {
          case "spending_pie_chart":
            return <SpendingPieChart key={idx} data={comp.data as SpendingPieChartData} title={comp.title} />;
          case "accounts_bar_chart":
            return <AccountsBarChart key={idx} data={comp.data as AccountsBarChartData} title={comp.title} />;
          case "bnpl_cards":
            return <BnplCards key={idx} data={comp.data as BnplCardData} title={comp.title} />;
          case "wishlist_cards":
            return <WishlistCards key={idx} data={comp.data as WishlistCardData} title={comp.title} onAction={onAction} />;
          case "savings_goals_progress":
            return <SavingsGoalsProgress key={idx} data={comp.data as SavingsGoalsProgressData} title={comp.title} />;
          case "transactions_table":
            return <TransactionsTable key={idx} data={comp.data as TransactionsTableData} title={comp.title} />;
          case "affordability_verdict":
            return <AffordabilityVerdict key={idx} data={comp.data as AffordabilityVerdictData} title={comp.title} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
