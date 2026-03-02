// ── UI Component Types for Generative Chat UI ──────────────

export type UIComponentType =
  | "spending_pie_chart"
  | "accounts_bar_chart"
  | "bnpl_cards"
  | "wishlist_cards"
  | "savings_goals_progress"
  | "transactions_table"
  | "affordability_verdict";

export interface UIComponent {
  type: UIComponentType;
  title: string;
  data: unknown;
}

// ── Per-component data shapes ───────────────────────────────

export interface SpendingPieChartData {
  segments: { category: string; amount: number }[];
}

export interface AccountsBarChartData {
  accounts: { name: string; balance: number; type: "bank" | "credit_card" }[];
}

export interface BnplCardData {
  plans: {
    id: number;
    provider: string;
    itemName: string;
    totalAmount: number;
    instalmentAmount: number;
    frequency: string;
    instalmentsRemaining: number;
    instalmentsTotal: number;
    nextPaymentDate: string;
    remainingDebt: number;
  }[];
}

export interface WishlistCardData {
  items: {
    id: number;
    name: string;
    price: number;
    store: string | null;
    priority: number;
    status: string;
    category: string | null;
  }[];
}

export interface SavingsGoalsProgressData {
  goals: {
    id: number;
    name: string;
    currentAmount: number;
    targetAmount: number;
    progressPercent: number;
    deadline: string | null;
  }[];
}

export interface TransactionsTableData {
  transactions: {
    id: number;
    date: string;
    description: string;
    amount: number;
    category: string | null;
    isIncome: boolean;
  }[];
}

export interface AffordabilityVerdictData {
  item: string;
  price: number;
  safeToSpend: number;
  canAfford: boolean;
  availableBalance: number;
  daysUntilPay: number;
}

// ── Chat Actions (for interactive buttons) ──────────────────

export type ChatAction =
  | { type: "send_message"; content: string }
  | { type: "navigate"; path: string };
