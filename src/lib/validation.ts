import { z } from "zod";

// Account schemas
export const accountSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(["bank", "credit_card"]),
  balance: z.number().int().default(0),
  creditLimit: z.number().int().optional(),
  interestRate: z.string().optional(),
  statementDate: z.number().int().min(1).max(31).optional(),
  dueDate: z.number().int().min(1).max(31).optional(),
});

export const accountUpdateSchema = accountSchema.partial();

// Transaction schemas
export const transactionSchema = z.object({
  accountId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  description: z.string().min(1, "Description is required"),
  amount: z.number().int(), // cents
  category: z.string().optional(),
  isReviewed: z.boolean().default(false),
});

export const transactionImportSchema = z.array(transactionSchema);

// Income schemas
export const incomeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  amount: z.number().int().positive(), // cents
  frequency: z.enum(["weekly", "fortnightly", "monthly"]),
  nextPayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  accountId: z.number().int().positive().optional(),
});

// Fixed expense schemas
export const fixedExpenseSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  amount: z.number().int().positive(), // cents
  frequency: z.enum(["weekly", "fortnightly", "monthly", "quarterly", "yearly"]),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  category: z.string().optional(),
  isActive: z.boolean().default(true),
});

// Savings goal schemas
export const savingsGoalSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  targetAmount: z.number().int().positive(),
  currentAmount: z.number().int().min(0).default(0),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional(),
  priority: z.number().int().min(1).max(5).default(3),
});

// Wishlist schemas
export const wishlistItemSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  price: z.number().int().positive(),
  url: z.string().url().optional(),
  store: z.string().max(100).optional(),
  priority: z.number().int().min(1).max(5).default(3),
  notes: z.string().max(1000).optional(),
  category: z.string().max(50).optional(),
  status: z.enum(["wanted", "saving", "purchased", "archived"]).default("wanted"),
  linkedGoalId: z.number().int().positive().optional(),
});

// BNPL schemas
export const bnplAccountSchema = z.object({
  provider: z.string().min(1, "Provider is required").max(50),
  spendingLimit: z.number().int().positive(),
  availableLimit: z.number().int().min(0),
  lateFeeAmount: z.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
  notes: z.string().max(500).optional(),
});

export const bnplPlanSchema = z.object({
  itemName: z.string().min(1, "Item name is required").max(200),
  totalAmount: z.number().int().positive(),
  instalmentAmount: z.number().int().positive(),
  instalmentFrequency: z.enum(["weekly", "fortnightly", "monthly"]),
  instalmentsTotal: z.number().int().positive(),
  instalmentsRemaining: z.number().int().min(0),
  nextPaymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  bnplAccountId: z.number().int().positive(),
});

// Chat/API request schemas
export const chatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationId: z.number().int().positive().optional(),
  attachments: z.array(z.object({
    type: z.enum(["image", "pdf"]),
    content: z.string(), // base64
  })).max(5).optional(),
});

export const categoriseRequestSchema = z.object({
  descriptions: z.array(z.string().min(1)).min(1).max(50),
});

export const affordabilityCheckSchema = z.object({
  wishlistItemId: z.number().int().positive(),
});

// Query parameter schemas
export const transactionQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  category: z.string().optional(),
  accountId: z.coerce.number().int().positive().optional(),
  search: z.string().max(100).optional(),
  reviewed: z.enum(["true", "false"]).optional(),
});

// Type exports
export type AccountInput = z.infer<typeof accountSchema>;
export type TransactionInput = z.infer<typeof transactionSchema>;
export type IncomeInput = z.infer<typeof incomeSchema>;
export type FixedExpenseInput = z.infer<typeof fixedExpenseSchema>;
export type SavingsGoalInput = z.infer<typeof savingsGoalSchema>;
export type WishlistItemInput = z.infer<typeof wishlistItemSchema>;
export type BnplAccountInput = z.infer<typeof bnplAccountSchema>;
export type BnplPlanInput = z.infer<typeof bnplPlanSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
