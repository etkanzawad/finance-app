// Type definitions matching the API response format (camelCase)
// The toCamel() utility converts snake_case DB responses to these types

export interface Income {
  id: number;
  name: string;
  amount: number;
  frequency: "weekly" | "fortnightly" | "monthly";
  nextPayDate: string;
  accountId: number | null;
  lastProcessedDate: string | null;
  createdAt: string;
}

export interface Account {
  id: number;
  name: string;
  type: "bank" | "credit_card";
  balance: number;
  creditLimit: number | null;
  interestRate: string | null;
  statementDate: number | null;
  dueDate: number | null;
  createdAt: string;
}

export interface BnplAccount {
  id: number;
  provider: "afterpay" | "zip_pay" | "zip_money" | "paypal_pay4";
  spendingLimit: number;
  availableLimit: number;
  lateFeeAmount: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
}

export interface BnplPlan {
  id: number;
  bnplAccountId: number;
  itemName: string;
  totalAmount: number;
  instalmentAmount: number;
  instalmentFrequency: "weekly" | "fortnightly" | "monthly";
  instalmentsTotal: number;
  instalmentsRemaining: number;
  nextPaymentDate: string;
  createdAt: string;
}

export interface FixedExpense {
  id: number;
  name: string;
  amount: number;
  frequency: "weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly";
  nextDueDate: string;
  category: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Transaction {
  id: number;
  accountId: number;
  date: string;
  rawDescription: string;
  cleanDescription: string | null;
  amount: number;
  balanceAfter: number | null;
  category: string | null;
  isIncome: boolean;
  isReviewed: boolean;
  statementMonth: string | null;
  createdAt: string;
}

export interface SavingsGoal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  priority: number;
  createdAt: string;
}

export interface MerchantMapping {
  id: number;
  rawPattern: string;
  cleanName: string;
  category: string;
  createdAt: string;
}

export interface WishlistItem {
  id: number;
  name: string;
  price: number;
  url: string | null;
  store: string | null;
  priority: number;
  notes: string | null;
  category: string | null;
  status: "wanted" | "saving" | "purchased" | "archived";
  linkedGoalId: number | null;
  dateAdded: string;
  datePurchased: string | null;
  createdAt: string;
}

export interface Setting {
  id: number;
  key: string;
  value: string;
}

export interface Conversation {
  id: number;
  title: string;
  messages: string;
  createdAt: string;
  updatedAt: string;
}

export interface BnplAgreement {
  id: number;
  provider: "afterpay" | "zip_pay" | "zip_money" | "paypal_pay4";
  fileName: string;
  fileSize: number;
  storagePath: string;
  publicUrl: string;
  extractedText: string | null;
  notes: string | null;
  createdAt: string;
}

// Insert types (omit auto-generated fields)
export type NewIncome = Omit<Income, "id" | "createdAt">;
export type NewAccount = Omit<Account, "id" | "createdAt">;
export type NewBnplAccount = Omit<BnplAccount, "id" | "createdAt">;
export type NewBnplPlan = Omit<BnplPlan, "id" | "createdAt">;
export type NewFixedExpense = Omit<FixedExpense, "id" | "createdAt">;
export type NewTransaction = Omit<Transaction, "id" | "createdAt">;
export type NewSavingsGoal = Omit<SavingsGoal, "id" | "createdAt">;
export type NewMerchantMapping = Omit<MerchantMapping, "id" | "createdAt">;
export type NewWishlistItem = Omit<WishlistItem, "id" | "createdAt">;
export type NewConversation = Omit<Conversation, "id" | "createdAt" | "updatedAt">;
export type NewBnplAgreement = Omit<BnplAgreement, "id" | "createdAt">;
