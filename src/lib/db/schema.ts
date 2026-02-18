import { pgTable, text, integer, serial, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const income = pgTable("income", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  amount: integer("amount").notNull(), // cents
  frequency: text("frequency").notNull().$type<"weekly" | "fortnightly" | "monthly">(),
  nextPayDate: text("next_pay_date").notNull(),
  accountId: integer("account_id").references(() => accounts.id, { onDelete: "set null" }),
  lastProcessedDate: text("last_processed_date"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().$type<"bank" | "credit_card">(),
  balance: integer("balance").notNull().default(0), // cents
  creditLimit: integer("credit_limit"), // cents, nullable for credit cards
  interestRate: text("interest_rate"), // stored as string e.g. "19.99"
  statementDate: integer("statement_date"), // day of month
  dueDate: integer("due_date"), // day of month
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const bnplAccounts = pgTable("bnpl_accounts", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().$type<"afterpay" | "zip_pay" | "zip_money" | "paypal_pay4">(),
  spendingLimit: integer("spending_limit").notNull(), // cents
  availableLimit: integer("available_limit").notNull(), // cents
  lateFeeAmount: integer("late_fee_amount"), // cents
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const bnplPlans = pgTable("bnpl_plans", {
  id: serial("id").primaryKey(),
  bnplAccountId: integer("bnpl_account_id")
    .notNull()
    .references(() => bnplAccounts.id),
  itemName: text("item_name").notNull(),
  totalAmount: integer("total_amount").notNull(), // cents
  instalmentAmount: integer("instalment_amount").notNull(), // cents
  instalmentFrequency: text("instalment_frequency").notNull().$type<"weekly" | "fortnightly" | "monthly">(),
  instalmentsTotal: integer("instalments_total").notNull(),
  instalmentsRemaining: integer("instalments_remaining").notNull(),
  nextPaymentDate: text("next_payment_date").notNull(),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const fixedExpenses = pgTable("fixed_expenses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  amount: integer("amount").notNull(), // cents
  frequency: text("frequency").notNull().$type<"weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly">(),
  nextDueDate: text("next_due_date").notNull(),
  category: text("category"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id),
  date: text("date").notNull(),
  rawDescription: text("raw_description").notNull(),
  cleanDescription: text("clean_description"),
  amount: integer("amount").notNull(), // cents (negative for debits)
  balanceAfter: integer("balance_after"), // cents
  category: text("category"),
  isIncome: boolean("is_income").notNull().default(false),
  isReviewed: boolean("is_reviewed").notNull().default(false),
  statementMonth: text("statement_month"), // "2024-01" format
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const savingsGoals = pgTable("savings_goals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  targetAmount: integer("target_amount").notNull(), // cents
  currentAmount: integer("current_amount").notNull().default(0), // cents
  deadline: text("deadline"),
  priority: integer("priority").notNull().default(3), // 1-5
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const merchantMappings = pgTable("merchant_mappings", {
  id: serial("id").primaryKey(),
  rawPattern: text("raw_pattern").notNull(),
  cleanName: text("clean_name").notNull(),
  category: text("category").notNull(),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const wishlistItems = pgTable("wishlist_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: integer("price").notNull(), // cents
  url: text("url"),
  store: text("store"),
  priority: integer("priority").notNull().default(3), // 1-5
  notes: text("notes"),
  category: text("category"),
  status: text("status").notNull().default("wanted").$type<"wanted" | "saving" | "purchased" | "archived">(),
  linkedGoalId: integer("linked_goal_id").references(() => savingsGoals.id, { onDelete: "set null" }),
  dateAdded: text("date_added").notNull(),
  datePurchased: text("date_purchased"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(), // JSON string
});

// Type exports
export type Income = typeof income.$inferSelect;
export type NewIncome = typeof income.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type BnplAccount = typeof bnplAccounts.$inferSelect;
export type NewBnplAccount = typeof bnplAccounts.$inferInsert;
export type BnplPlan = typeof bnplPlans.$inferSelect;
export type NewBnplPlan = typeof bnplPlans.$inferInsert;
export type FixedExpense = typeof fixedExpenses.$inferSelect;
export type NewFixedExpense = typeof fixedExpenses.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type NewSavingsGoal = typeof savingsGoals.$inferInsert;
export type MerchantMapping = typeof merchantMappings.$inferSelect;
export type NewMerchantMapping = typeof merchantMappings.$inferInsert;
export type WishlistItem = typeof wishlistItems.$inferSelect;
export type NewWishlistItem = typeof wishlistItems.$inferInsert;
export type Setting = typeof settings.$inferSelect;
