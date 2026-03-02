import { NextRequest } from "next/server";
import { Type, FunctionCallingConfigMode, type Tool, type Content, type Part } from "@google/genai";
import { db, schema } from "@/lib/db";
import { eq, and, like, ilike, or, desc, gte, lt, sql } from "drizzle-orm";
import { calculateSafeToSpend } from "@/lib/cashflow";
import { format, addDays, startOfMonth } from "date-fns";
import { getAI, MODEL } from "@/lib/chat-helpers";
import type { UIComponent } from "@/lib/ui-components";

// ── function declarations (tools Gemini can call) ────────────
const tools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "get_dashboard_summary",
        description:
          "Get a full financial overview: net position, safe-to-spend, bank balances, credit card debt, BNPL debt, upcoming payments, and spending breakdown for the current month.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "get_accounts",
        description:
          "List all bank accounts and credit cards with their current balances.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "get_account_by_name",
        description: "Find a specific account by name (partial match).",
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Account name to search for" },
          },
          required: ["name"],
        },
      },
      {
        name: "update_account_balance",
        description:
          "Update the balance of a bank account or credit card. Amount is in dollars (e.g. 1500.50).",
        parameters: {
          type: Type.OBJECT,
          properties: {
            account_id: { type: Type.NUMBER, description: "The account ID" },
            new_balance_dollars: {
              type: Type.NUMBER,
              description: "New balance in dollars",
            },
          },
          required: ["account_id", "new_balance_dollars"],
        },
      },
      {
        name: "get_transactions",
        description:
          "Query transactions. Can filter by month (YYYY-MM), category, or search term. Returns most recent first.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            month: { type: Type.STRING, description: "Filter by month YYYY-MM" },
            category: { type: Type.STRING, description: "Filter by category" },
            search: {
              type: Type.STRING,
              description: "Search in transaction descriptions",
            },
            limit: {
              type: Type.NUMBER,
              description: "Max results (default 20)",
            },
          },
        },
      },
      {
        name: "get_income",
        description: "List all income sources with amounts and frequencies.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "update_income",
        description: "Update an income source's details.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            income_id: { type: Type.NUMBER, description: "The income ID" },
            name: { type: Type.STRING, description: "Income source name" },
            amount_dollars: { type: Type.NUMBER, description: "Amount in dollars" },
            frequency: {
              type: Type.STRING,
              description: "weekly, fortnightly, or monthly",
            },
            next_pay_date: {
              type: Type.STRING,
              description: "Next pay date YYYY-MM-DD",
            },
          },
          required: ["income_id"],
        },
      },
      {
        name: "get_fixed_expenses",
        description:
          "List all fixed/recurring expenses (bills, subscriptions, etc.).",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "update_fixed_expense",
        description: "Update a fixed expense.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            expense_id: { type: Type.NUMBER, description: "The expense ID" },
            name: { type: Type.STRING },
            amount_dollars: { type: Type.NUMBER },
            frequency: { type: Type.STRING },
            next_due_date: { type: Type.STRING },
            is_active: { type: Type.BOOLEAN },
          },
          required: ["expense_id"],
        },
      },
      {
        name: "get_bnpl_plans",
        description:
          "List active Buy Now Pay Later plans with remaining instalments.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "get_bnpl_accounts",
        description: "List BNPL accounts (Afterpay, Zip, etc.) with limits.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "get_wishlist",
        description: "List all wishlist items with prices and statuses.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "update_wishlist_item",
        description:
          "Update a wishlist item (status, priority, price, etc.).",
        parameters: {
          type: Type.OBJECT,
          properties: {
            item_id: { type: Type.NUMBER, description: "The wishlist item ID" },
            status: {
              type: Type.STRING,
              description: "wanted, saving, purchased, or archived",
            },
            priority: { type: Type.NUMBER, description: "1-5" },
            price_dollars: { type: Type.NUMBER },
            name: { type: Type.STRING },
          },
          required: ["item_id"],
        },
      },
      {
        name: "add_wishlist_item",
        description: "Add a new item to the wishlist.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Item name" },
            price_dollars: { type: Type.NUMBER, description: "Price in dollars" },
            store: { type: Type.STRING, description: "Store name" },
            category: { type: Type.STRING },
            priority: { type: Type.NUMBER, description: "1-5, default 3" },
            notes: { type: Type.STRING },
          },
          required: ["name", "price_dollars"],
        },
      },
      {
        name: "get_savings_goals",
        description: "List all savings goals with progress.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "update_savings_goal",
        description: "Update a savings goal's current amount or target.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            goal_id: { type: Type.NUMBER, description: "The goal ID" },
            current_amount_dollars: { type: Type.NUMBER },
            target_amount_dollars: { type: Type.NUMBER },
            name: { type: Type.STRING },
          },
          required: ["goal_id"],
        },
      },
      {
        name: "affordability_check",
        description:
          "Check whether the user can afford a specific item given their current financial situation. Provide the item name and price.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            item_name: { type: Type.STRING, description: "What they want to buy" },
            price_dollars: {
              type: Type.NUMBER,
              description: "Price in dollars",
            },
          },
          required: ["item_name", "price_dollars"],
        },
      },
      {
        name: "bulk_categorize_transactions",
        description:
          "Bulk update the category for transactions matching merchant name patterns. Also creates merchant mappings so future imports auto-categorize. Use this when the user wants to categorize multiple transactions at once (e.g. 'categorize all Coles and Woolies as Groceries').",
        parameters: {
          type: Type.OBJECT,
          properties: {
            search_patterns: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "Merchant name patterns to match (e.g. ['Coles', 'Woolworths', 'Aldi']). Matches against transaction descriptions (case-insensitive).",
            },
            new_category: {
              type: Type.STRING,
              description:
                "Category to assign. Must be one of: Groceries, Dining, Transport, Entertainment, Shopping, Health, Utilities, Rent/Housing, Subscriptions, Insurance, Transfers, Income, Cash Withdrawal, Fees, Other",
            },
            month: {
              type: Type.STRING,
              description: "Optional: limit to a specific month (YYYY-MM)",
            },
          },
          required: ["search_patterns", "new_category"],
        },
      },
      {
        name: "find_recurring_transactions",
        description:
          "Find recurring/subscription-like transactions by grouping repeated payments. Great for subscription audits - finds charges that appear multiple times. Returns grouped results with count, total spent, and average amount.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            max_amount_dollars: {
              type: Type.NUMBER,
              description:
                "Optional: only show recurring charges where average amount is at most this (in dollars). E.g. 20 to find subscriptions under $20.",
            },
            min_occurrences: {
              type: Type.NUMBER,
              description:
                "Minimum number of times a charge must appear to be considered recurring (default 3).",
            },
          },
        },
      },
      {
        name: "update_transaction",
        description:
          "Update a single transaction's category or clean description.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            transaction_id: {
              type: Type.NUMBER,
              description: "The transaction ID",
            },
            category: {
              type: Type.STRING,
              description: "New category to assign",
            },
            clean_description: {
              type: Type.STRING,
              description: "New clean description",
            },
          },
          required: ["transaction_id"],
        },
      },
      {
        name: "add_transaction",
        description:
          "Add a new transaction (e.g. from a receipt scan or manual entry). Amount is in dollars — negative for expenses (e.g. -45.50), positive for income. Requires an account_id — if unsure, call get_accounts first to find the right account.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            account_id: {
              type: Type.NUMBER,
              description: "The account ID to add the transaction to",
            },
            date: {
              type: Type.STRING,
              description: "Transaction date YYYY-MM-DD",
            },
            description: {
              type: Type.STRING,
              description: "Clean merchant/description name",
            },
            amount_dollars: {
              type: Type.NUMBER,
              description:
                "Amount in dollars. Negative for expenses (e.g. -45.50), positive for income",
            },
            category: {
              type: Type.STRING,
              description:
                "Category: Groceries, Dining, Transport, Entertainment, Shopping, Health, Utilities, Rent/Housing, Subscriptions, Insurance, Transfers, Income, Cash Withdrawal, Fees, Other",
            },
          },
          required: [
            "account_id",
            "date",
            "description",
            "amount_dollars",
            "category",
          ],
        },
      },
      {
        name: "add_fixed_expense",
        description:
          "Add a new fixed/recurring expense (e.g. from a bill scan). Used for bills, subscriptions, and regular payments the user wants to track.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description:
                "Expense name (e.g. 'Telstra Mobile', 'AGL Electricity')",
            },
            amount_dollars: {
              type: Type.NUMBER,
              description: "Amount in dollars",
            },
            frequency: {
              type: Type.STRING,
              description:
                "Payment frequency: weekly, fortnightly, monthly, quarterly, yearly",
            },
            next_due_date: {
              type: Type.STRING,
              description: "Next due date YYYY-MM-DD",
            },
            category: {
              type: Type.STRING,
              description: "Category (e.g. Utilities, Subscriptions, Insurance)",
            },
          },
          required: ["name", "amount_dollars", "frequency", "next_due_date"],
        },
      },
      {
        name: "delete_fixed_expense",
        description: "Delete / remove a fixed expense permanently.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            expense_id: { type: Type.NUMBER, description: "The expense ID to delete" },
          },
          required: ["expense_id"],
        },
      },
      {
        name: "add_account",
        description: "Add a new bank account or credit card.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Account name (e.g. 'NAB Savings')" },
            type: { type: Type.STRING, description: "Account type: bank or credit_card" },
            balance_dollars: { type: Type.NUMBER, description: "Starting balance in dollars" },
            credit_limit_dollars: { type: Type.NUMBER, description: "Credit card limit in dollars (credit cards only)" },
            interest_rate: { type: Type.STRING, description: "Interest rate as string e.g. '19.99'" },
          },
          required: ["name", "type", "balance_dollars"],
        },
      },
      {
        name: "delete_account",
        description: "Delete a bank account or credit card permanently.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            account_id: { type: Type.NUMBER, description: "The account ID to delete" },
          },
          required: ["account_id"],
        },
      },
      {
        name: "add_income",
        description: "Add a new income source (salary, freelance, etc.).",
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Income source name e.g. 'Freelance Work'" },
            amount_dollars: { type: Type.NUMBER, description: "Amount per pay period in dollars" },
            frequency: { type: Type.STRING, description: "weekly, fortnightly, or monthly" },
            next_pay_date: { type: Type.STRING, description: "Next pay date YYYY-MM-DD" },
          },
          required: ["name", "amount_dollars", "frequency", "next_pay_date"],
        },
      },
      {
        name: "delete_income",
        description: "Delete an income source permanently.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            income_id: { type: Type.NUMBER, description: "The income ID to delete" },
          },
          required: ["income_id"],
        },
      },
      {
        name: "add_bnpl_plan",
        description: "Add a new BNPL instalment plan. The user must have an existing BNPL account (use get_bnpl_accounts to find the ID). All amounts in dollars.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            bnpl_account_id: { type: Type.NUMBER, description: "The BNPL account ID (from get_bnpl_accounts)" },
            item_name: { type: Type.STRING, description: "What was purchased" },
            total_amount_dollars: { type: Type.NUMBER, description: "Total purchase price in dollars" },
            instalment_amount_dollars: { type: Type.NUMBER, description: "Amount per instalment in dollars" },
            instalment_frequency: { type: Type.STRING, description: "weekly, fortnightly, or monthly" },
            instalments_total: { type: Type.NUMBER, description: "Total number of instalments" },
            instalments_remaining: { type: Type.NUMBER, description: "Remaining instalments" },
            next_payment_date: { type: Type.STRING, description: "Next payment date YYYY-MM-DD" },
          },
          required: ["bnpl_account_id", "item_name", "total_amount_dollars", "instalment_amount_dollars", "instalment_frequency", "instalments_total", "instalments_remaining", "next_payment_date"],
        },
      },
      {
        name: "update_bnpl_plan",
        description: "Update a BNPL plan's remaining instalments or next payment date.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            plan_id: { type: Type.NUMBER, description: "The BNPL plan ID" },
            instalments_remaining: { type: Type.NUMBER, description: "New number of instalments remaining" },
            next_payment_date: { type: Type.STRING, description: "New next payment date YYYY-MM-DD" },
          },
          required: ["plan_id"],
        },
      },
      {
        name: "add_savings_goal",
        description: "Create a new savings goal.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Goal name e.g. 'Holiday Fund'" },
            target_amount_dollars: { type: Type.NUMBER, description: "Target amount in dollars" },
            current_amount_dollars: { type: Type.NUMBER, description: "Current saved amount in dollars (default 0)" },
            deadline: { type: Type.STRING, description: "Deadline date YYYY-MM-DD (optional)" },
            priority: { type: Type.NUMBER, description: "Priority 1-5 (1=critical, 5=someday, default 3)" },
          },
          required: ["name", "target_amount_dollars"],
        },
      },
      {
        name: "delete_savings_goal",
        description: "Delete a savings goal permanently.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            goal_id: { type: Type.NUMBER, description: "The savings goal ID to delete" },
          },
          required: ["goal_id"],
        },
      },
      {
        name: "delete_wishlist_item",
        description: "Remove a wishlist item permanently.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            item_id: { type: Type.NUMBER, description: "The wishlist item ID to delete" },
          },
          required: ["item_id"],
        },
      },
    ],
  },
];

// ── function executor ────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeFunction(name: string, args: Record<string, any>): Promise<Record<string, unknown>> {
  switch (name) {
    case "get_dashboard_summary": {
      const today = format(new Date(), "yyyy-MM-dd");
      const in14Days = format(addDays(new Date(), 14), "yyyy-MM-dd");
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

      const [incomes, bankAccounts, creditCards, bnplPlansData, fixedExp, monthlySpending] =
        await Promise.all([
          db.select().from(schema.income),
          db.select().from(schema.accounts).where(eq(schema.accounts.type, "bank")),
          db.select().from(schema.accounts).where(eq(schema.accounts.type, "credit_card")),
          db
            .select({
              id: schema.bnplPlans.id,
              itemName: schema.bnplPlans.itemName,
              instalmentAmount: schema.bnplPlans.instalmentAmount,
              instalmentFrequency: schema.bnplPlans.instalmentFrequency,
              instalmentsRemaining: schema.bnplPlans.instalmentsRemaining,
              nextPaymentDate: schema.bnplPlans.nextPaymentDate,
              provider: schema.bnplAccounts.provider,
            })
            .from(schema.bnplPlans)
            .innerJoin(schema.bnplAccounts, eq(schema.bnplPlans.bnplAccountId, schema.bnplAccounts.id))
            .where(and(eq(schema.bnplAccounts.isActive, true), sql`${schema.bnplPlans.instalmentsRemaining} > 0`)),
          db.select().from(schema.fixedExpenses).where(eq(schema.fixedExpenses.isActive, true)),
          db
            .select({
              category: schema.transactions.category,
              total: sql<number>`SUM(ABS(${schema.transactions.amount}))`,
            })
            .from(schema.transactions)
            .where(
              and(
                gte(schema.transactions.date, monthStart),
                lt(schema.transactions.amount, 0),
                eq(schema.transactions.isIncome, false)
              )
            )
            .groupBy(schema.transactions.category),
        ]);

      const totalBankBalance = bankAccounts.reduce((s, a) => s + a.balance, 0);
      const currentAccountNames = ["current"];
      const isCurrentAccount = (n: string) => currentAccountNames.some((kw) => n.toLowerCase().includes(kw));
      const expenseAccountBalance = bankAccounts.filter((a) => isCurrentAccount(a.name)).reduce((s, a) => s + a.balance, 0);
      const availableBalance = bankAccounts.filter((a) => !isCurrentAccount(a.name)).reduce((s, a) => s + a.balance, 0);
      const totalCreditCardDebt = creditCards.reduce((s, a) => s + a.balance, 0);
      const totalBnplDebt = bnplPlansData.reduce((s, p) => s + p.instalmentAmount * p.instalmentsRemaining, 0);
      const netPosition = totalBankBalance - totalCreditCardDebt - totalBnplDebt;

      const sts = calculateSafeToSpend({
        currentBalance: availableBalance,
        incomes: incomes.map((i) => ({ name: i.name, amount: i.amount, frequency: i.frequency, nextPayDate: i.nextPayDate })),
        expenses: [],
        bnplPayments: bnplPlansData.map((p) => ({
          itemName: p.itemName,
          provider: p.provider,
          instalmentAmount: p.instalmentAmount,
          instalmentFrequency: p.instalmentFrequency,
          instalmentsRemaining: p.instalmentsRemaining,
          nextPaymentDate: p.nextPaymentDate,
        })),
        creditCards: [],
      });

      // Upcoming payments
      const allUpcoming: { name: string; amount: number; date: string; type: string }[] = [];
      for (const exp of fixedExp) {
        if (exp.nextDueDate >= today && exp.nextDueDate <= in14Days)
          allUpcoming.push({ name: exp.name, amount: exp.amount, date: exp.nextDueDate, type: "expense" });
      }
      for (const plan of bnplPlansData) {
        if (plan.nextPaymentDate >= today && plan.nextPaymentDate <= in14Days && plan.instalmentsRemaining > 0)
          allUpcoming.push({ name: `${plan.provider} - ${plan.itemName}`, amount: plan.instalmentAmount, date: plan.nextPaymentDate, type: "bnpl" });
      }
      allUpcoming.sort((a, b) => a.date.localeCompare(b.date));

      return {
        netPosition_dollars: (netPosition / 100).toFixed(2),
        totalBankBalance_dollars: (totalBankBalance / 100).toFixed(2),
        availableBalance_dollars: (availableBalance / 100).toFixed(2),
        expenseAccountBalance_dollars: (expenseAccountBalance / 100).toFixed(2),
        totalCreditCardDebt_dollars: (totalCreditCardDebt / 100).toFixed(2),
        totalBnplDebt_dollars: (totalBnplDebt / 100).toFixed(2),
        safeToSpend_dollars: (sts.safeToSpend / 100).toFixed(2),
        nextPayDate: sts.nextPayDate,
        daysUntilPay: sts.daysUntilPay,
        upcomingPayments: allUpcoming.map((u) => ({ ...u, amount_dollars: (u.amount / 100).toFixed(2) })),
        spendingByCategory: monthlySpending.map((s) => ({ category: s.category || "Uncategorised", amount_dollars: (Number(s.total) / 100).toFixed(2) })),
        bankAccounts: bankAccounts.map((a) => ({ id: a.id, name: a.name, balance_dollars: (a.balance / 100).toFixed(2) })),
        creditCards: creditCards.map((c) => ({ id: c.id, name: c.name, balance_dollars: (c.balance / 100).toFixed(2), limit_dollars: c.creditLimit ? (c.creditLimit / 100).toFixed(2) : null })),
      };
    }

    case "get_accounts": {
      const rows = await db.select().from(schema.accounts).orderBy(schema.accounts.name);
      return {
        accounts: rows.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          balance_dollars: (a.balance / 100).toFixed(2),
          creditLimit_dollars: a.creditLimit ? (a.creditLimit / 100).toFixed(2) : null,
          interestRate: a.interestRate,
        })),
      };
    }

    case "get_account_by_name": {
      const rows = await db
        .select()
        .from(schema.accounts)
        .where(like(schema.accounts.name, `%${args.name}%`));
      return {
        accounts: rows.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          balance_dollars: (a.balance / 100).toFixed(2),
          creditLimit_dollars: a.creditLimit ? (a.creditLimit / 100).toFixed(2) : null,
        })),
      };
    }

    case "update_account_balance": {
      const cents = Math.round(args.new_balance_dollars * 100);
      const result = await db
        .update(schema.accounts)
        .set({ balance: cents })
        .where(eq(schema.accounts.id, args.account_id))
        .returning();
      if (result.length === 0) return { error: "Account not found" };
      return { success: true, account: { id: result[0].id, name: result[0].name, new_balance_dollars: (result[0].balance / 100).toFixed(2) } };
    }

    case "get_transactions": {
      const conditions = [];
      if (args.month) conditions.push(eq(schema.transactions.statementMonth, args.month));
      if (args.category) conditions.push(eq(schema.transactions.category, args.category));
      if (args.search) conditions.push(like(schema.transactions.cleanDescription, `%${args.search}%`));

      const limit = args.limit || 20;
      const rows =
        conditions.length > 0
          ? await db.select().from(schema.transactions).where(and(...conditions)).orderBy(desc(schema.transactions.date)).limit(limit)
          : await db.select().from(schema.transactions).orderBy(desc(schema.transactions.date)).limit(limit);

      return {
        transactions: rows.map((t) => ({
          id: t.id,
          date: t.date,
          description: t.cleanDescription || t.rawDescription,
          amount_dollars: (t.amount / 100).toFixed(2),
          category: t.category,
          isIncome: t.isIncome,
        })),
        count: rows.length,
      };
    }

    case "get_income": {
      const rows = await db.select().from(schema.income).orderBy(schema.income.name);
      return {
        incomes: rows.map((i) => ({
          id: i.id,
          name: i.name,
          amount_dollars: (i.amount / 100).toFixed(2),
          frequency: i.frequency,
          nextPayDate: i.nextPayDate,
        })),
      };
    }

    case "update_income": {
      const updates: Record<string, unknown> = {};
      if (args.name) updates.name = args.name;
      if (args.amount_dollars) updates.amount = Math.round(args.amount_dollars * 100);
      if (args.frequency) updates.frequency = args.frequency;
      if (args.next_pay_date) updates.nextPayDate = args.next_pay_date;
      const result = await db.update(schema.income).set(updates).where(eq(schema.income.id, args.income_id)).returning();
      if (result.length === 0) return { error: "Income not found" };
      return { success: true, income: { id: result[0].id, name: result[0].name, amount_dollars: (result[0].amount / 100).toFixed(2) } };
    }

    case "get_fixed_expenses": {
      const rows = await db.select().from(schema.fixedExpenses).orderBy(schema.fixedExpenses.name);
      return {
        expenses: rows.map((e) => ({
          id: e.id,
          name: e.name,
          amount_dollars: (e.amount / 100).toFixed(2),
          frequency: e.frequency,
          nextDueDate: e.nextDueDate,
          category: e.category,
          isActive: e.isActive,
        })),
      };
    }

    case "update_fixed_expense": {
      const updates: Record<string, unknown> = {};
      if (args.name) updates.name = args.name;
      if (args.amount_dollars !== undefined) updates.amount = Math.round(args.amount_dollars * 100);
      if (args.frequency) updates.frequency = args.frequency;
      if (args.next_due_date) updates.nextDueDate = args.next_due_date;
      if (args.is_active !== undefined) updates.isActive = args.is_active;
      const result = await db.update(schema.fixedExpenses).set(updates).where(eq(schema.fixedExpenses.id, args.expense_id)).returning();
      if (result.length === 0) return { error: "Expense not found" };
      return { success: true, expense: { id: result[0].id, name: result[0].name, amount_dollars: (result[0].amount / 100).toFixed(2) } };
    }

    case "get_bnpl_plans": {
      const rows = await db
        .select({
          id: schema.bnplPlans.id,
          itemName: schema.bnplPlans.itemName,
          totalAmount: schema.bnplPlans.totalAmount,
          instalmentAmount: schema.bnplPlans.instalmentAmount,
          instalmentFrequency: schema.bnplPlans.instalmentFrequency,
          instalmentsTotal: schema.bnplPlans.instalmentsTotal,
          instalmentsRemaining: schema.bnplPlans.instalmentsRemaining,
          nextPaymentDate: schema.bnplPlans.nextPaymentDate,
          provider: schema.bnplAccounts.provider,
        })
        .from(schema.bnplPlans)
        .innerJoin(schema.bnplAccounts, eq(schema.bnplPlans.bnplAccountId, schema.bnplAccounts.id))
        .where(sql`${schema.bnplPlans.instalmentsRemaining} > 0`);
      return {
        plans: rows.map((p) => ({
          id: p.id,
          provider: p.provider,
          itemName: p.itemName,
          totalAmount_dollars: (p.totalAmount / 100).toFixed(2),
          instalmentAmount_dollars: (p.instalmentAmount / 100).toFixed(2),
          frequency: p.instalmentFrequency,
          instalmentsRemaining: p.instalmentsRemaining,
          instalmentsTotal: p.instalmentsTotal,
          nextPaymentDate: p.nextPaymentDate,
          remainingDebt_dollars: ((p.instalmentAmount * p.instalmentsRemaining) / 100).toFixed(2),
        })),
      };
    }

    case "get_bnpl_accounts": {
      const rows = await db.select().from(schema.bnplAccounts).where(eq(schema.bnplAccounts.isActive, true));
      return {
        accounts: rows.map((a) => ({
          id: a.id,
          provider: a.provider,
          spendingLimit_dollars: (a.spendingLimit / 100).toFixed(2),
          availableLimit_dollars: (a.availableLimit / 100).toFixed(2),
        })),
      };
    }

    case "get_wishlist": {
      const rows = await db.select().from(schema.wishlistItems).orderBy(schema.wishlistItems.priority);
      return {
        items: rows.map((i) => ({
          id: i.id,
          name: i.name,
          price_dollars: (i.price / 100).toFixed(2),
          store: i.store,
          priority: i.priority,
          status: i.status,
          category: i.category,
          notes: i.notes,
        })),
      };
    }

    case "update_wishlist_item": {
      const updates: Record<string, unknown> = {};
      if (args.name) updates.name = args.name;
      if (args.status) updates.status = args.status;
      if (args.priority !== undefined) updates.priority = args.priority;
      if (args.price_dollars !== undefined) updates.price = Math.round(args.price_dollars * 100);
      const result = await db.update(schema.wishlistItems).set(updates).where(eq(schema.wishlistItems.id, args.item_id)).returning();
      if (result.length === 0) return { error: "Item not found" };
      return { success: true, item: { id: result[0].id, name: result[0].name, status: result[0].status, price_dollars: (result[0].price / 100).toFixed(2) } };
    }

    case "add_wishlist_item": {
      const result = await db
        .insert(schema.wishlistItems)
        .values({
          name: args.name,
          price: Math.round(args.price_dollars * 100),
          store: args.store ?? null,
          category: args.category ?? null,
          priority: args.priority ?? 3,
          notes: args.notes ?? null,
          status: "wanted",
          dateAdded: format(new Date(), "yyyy-MM-dd"),
        })
        .returning();
      return { success: true, item: { id: result[0].id, name: result[0].name, price_dollars: (result[0].price / 100).toFixed(2) } };
    }

    case "get_savings_goals": {
      const rows = await db.select().from(schema.savingsGoals).orderBy(schema.savingsGoals.priority);
      return {
        goals: rows.map((g) => ({
          id: g.id,
          name: g.name,
          currentAmount_dollars: (g.currentAmount / 100).toFixed(2),
          targetAmount_dollars: (g.targetAmount / 100).toFixed(2),
          progress_percent: g.targetAmount > 0 ? ((g.currentAmount / g.targetAmount) * 100).toFixed(1) : "0",
          deadline: g.deadline,
        })),
      };
    }

    case "update_savings_goal": {
      const updates: Record<string, unknown> = {};
      if (args.name) updates.name = args.name;
      if (args.current_amount_dollars !== undefined) updates.currentAmount = Math.round(args.current_amount_dollars * 100);
      if (args.target_amount_dollars !== undefined) updates.targetAmount = Math.round(args.target_amount_dollars * 100);
      const result = await db.update(schema.savingsGoals).set(updates).where(eq(schema.savingsGoals.id, args.goal_id)).returning();
      if (result.length === 0) return { error: "Goal not found" };
      return {
        success: true,
        goal: {
          id: result[0].id,
          name: result[0].name,
          currentAmount_dollars: (result[0].currentAmount / 100).toFixed(2),
          targetAmount_dollars: (result[0].targetAmount / 100).toFixed(2),
        },
      };
    }

    case "affordability_check": {
      // Build a quick financial snapshot
      const [incomes, bankAccounts, creditCards, bnplPlansData] = await Promise.all([
        db.select().from(schema.income),
        db.select().from(schema.accounts).where(eq(schema.accounts.type, "bank")),
        db.select().from(schema.accounts).where(eq(schema.accounts.type, "credit_card")),
        db
          .select({
            instalmentAmount: schema.bnplPlans.instalmentAmount,
            instalmentsRemaining: schema.bnplPlans.instalmentsRemaining,
          })
          .from(schema.bnplPlans)
          .innerJoin(schema.bnplAccounts, eq(schema.bnplPlans.bnplAccountId, schema.bnplAccounts.id))
          .where(and(eq(schema.bnplAccounts.isActive, true), sql`${schema.bnplPlans.instalmentsRemaining} > 0`)),
      ]);

      const totalBank = bankAccounts.reduce((s, a) => s + a.balance, 0);
      const ccDebt = creditCards.reduce((s, a) => s + a.balance, 0);
      const bnplDebt = bnplPlansData.reduce((s, p) => s + p.instalmentAmount * p.instalmentsRemaining, 0);
      const currentAccountNames = ["current"];
      const isCurrentAccount = (n: string) => currentAccountNames.some((kw) => n.toLowerCase().includes(kw));
      const available = bankAccounts.filter((a) => !isCurrentAccount(a.name)).reduce((s, a) => s + a.balance, 0);

      const sts = calculateSafeToSpend({
        currentBalance: available,
        incomes: incomes.map((i) => ({ name: i.name, amount: i.amount, frequency: i.frequency, nextPayDate: i.nextPayDate })),
        expenses: [],
        bnplPayments: [],
        creditCards: [],
      });

      const priceCents = Math.round(args.price_dollars * 100);
      const monthlyIncome = incomes.reduce((s, i) => {
        const mult = i.frequency === "weekly" ? 52 / 12 : i.frequency === "fortnightly" ? 26 / 12 : 1;
        return s + i.amount * mult;
      }, 0);

      return {
        item: args.item_name,
        price_dollars: args.price_dollars,
        safeToSpend_dollars: (sts.safeToSpend / 100).toFixed(2),
        availableBalance_dollars: (available / 100).toFixed(2),
        totalBankBalance_dollars: (totalBank / 100).toFixed(2),
        creditCardDebt_dollars: (ccDebt / 100).toFixed(2),
        bnplDebt_dollars: (bnplDebt / 100).toFixed(2),
        monthlyIncome_dollars: (monthlyIncome / 100).toFixed(2),
        canAffordFromSavings: available >= priceCents,
        canAffordFromSafeToSpend: sts.safeToSpend >= priceCents,
        daysUntilPay: sts.daysUntilPay,
      };
    }

    case "bulk_categorize_transactions": {
      const patterns: string[] = args.search_patterns;
      const newCategory: string = args.new_category;
      const month: string | undefined = args.month;

      let totalUpdated = 0;
      const updatedTransactions: { id: number; description: string; old_category: string | null; new_category: string }[] = [];

      for (const pattern of patterns) {
        // Build conditions: match cleanDescription or rawDescription
        const matchCondition = or(
          ilike(schema.transactions.cleanDescription, `%${pattern}%`),
          ilike(schema.transactions.rawDescription, `%${pattern}%`)
        );
        const conditions = month
          ? and(matchCondition, eq(schema.transactions.statementMonth, month))
          : matchCondition;

        // Find matching transactions first (for reporting)
        const matching = await db
          .select({ id: schema.transactions.id, cleanDescription: schema.transactions.cleanDescription, rawDescription: schema.transactions.rawDescription, category: schema.transactions.category })
          .from(schema.transactions)
          .where(conditions!);

        if (matching.length > 0) {
          // Update all matching transactions
          await db
            .update(schema.transactions)
            .set({ category: newCategory })
            .where(conditions!);

          for (const t of matching) {
            updatedTransactions.push({
              id: t.id,
              description: t.cleanDescription || t.rawDescription,
              old_category: t.category,
              new_category: newCategory,
            });
          }
          totalUpdated += matching.length;
        }

        // Create/update merchant mapping for future imports
        const existingMapping = await db
          .select()
          .from(schema.merchantMappings)
          .where(eq(schema.merchantMappings.rawPattern, pattern.toLowerCase()));

        if (existingMapping.length === 0) {
          await db.insert(schema.merchantMappings).values({
            rawPattern: pattern.toLowerCase(),
            cleanName: pattern,
            category: newCategory,
          });
        } else {
          await db
            .update(schema.merchantMappings)
            .set({ category: newCategory, cleanName: pattern })
            .where(eq(schema.merchantMappings.rawPattern, pattern.toLowerCase()));
        }
      }

      return {
        success: true,
        updated_count: totalUpdated,
        patterns_matched: patterns,
        new_category: newCategory,
        transactions: updatedTransactions.slice(0, 50), // Cap response size
        mappings_created: patterns.length,
        note: totalUpdated > 50 ? `Showing first 50 of ${totalUpdated} updated transactions` : undefined,
      };
    }

    case "find_recurring_transactions": {
      const minOccurrences = args.min_occurrences || 3;
      const maxAmountCents = args.max_amount_dollars ? Math.round(args.max_amount_dollars * 100) : null;

      const results = await db
        .select({
          description: schema.transactions.cleanDescription,
          count: sql<number>`COUNT(*)`,
          totalSpent: sql<number>`SUM(ABS(${schema.transactions.amount}))`,
          avgAmount: sql<number>`AVG(ABS(${schema.transactions.amount}))`,
          firstDate: sql<string>`MIN(${schema.transactions.date})`,
          lastDate: sql<string>`MAX(${schema.transactions.date})`,
          category: schema.transactions.category,
        })
        .from(schema.transactions)
        .where(eq(schema.transactions.isIncome, false))
        .groupBy(schema.transactions.cleanDescription, schema.transactions.category)
        .having(sql`COUNT(*) >= ${minOccurrences}`)
        .orderBy(sql`COUNT(*) DESC`);

      let filtered = results;
      if (maxAmountCents) {
        filtered = results.filter((r) => Number(r.avgAmount) <= maxAmountCents);
      }

      return {
        recurring_transactions: filtered.map((r) => ({
          description: r.description || "Unknown",
          category: r.category || "Uncategorised",
          occurrences: Number(r.count),
          total_spent_dollars: (Number(r.totalSpent) / 100).toFixed(2),
          avg_amount_dollars: (Number(r.avgAmount) / 100).toFixed(2),
          first_seen: r.firstDate,
          last_seen: r.lastDate,
        })),
        total_groups: filtered.length,
      };
    }

    case "update_transaction": {
      const updates: Record<string, unknown> = {};
      if (args.category) updates.category = args.category;
      if (args.clean_description) updates.cleanDescription = args.clean_description;
      const result = await db
        .update(schema.transactions)
        .set(updates)
        .where(eq(schema.transactions.id, args.transaction_id))
        .returning();
      if (result.length === 0) return { error: "Transaction not found" };
      return {
        success: true,
        transaction: {
          id: result[0].id,
          description: result[0].cleanDescription || result[0].rawDescription,
          category: result[0].category,
          amount_dollars: (result[0].amount / 100).toFixed(2),
        },
      };
    }

    case "add_transaction": {
      const amountCents = Math.round(args.amount_dollars * 100);
      const today = format(new Date(), "yyyy-MM-dd");
      const date = args.date || today;
      const statementMonth = date.substring(0, 7);

      const result = await db
        .insert(schema.transactions)
        .values({
          accountId: args.account_id,
          date,
          rawDescription: args.description,
          cleanDescription: args.description,
          amount: amountCents,
          category: args.category,
          isIncome: amountCents > 0,
          isReviewed: true,
          statementMonth,
        })
        .returning();

      return {
        success: true,
        transaction: {
          id: result[0].id,
          date: result[0].date,
          description: result[0].cleanDescription,
          amount_dollars: (result[0].amount / 100).toFixed(2),
          category: result[0].category,
        },
      };
    }

    case "add_fixed_expense": {
      const amountCents = Math.round(args.amount_dollars * 100);

      const result = await db
        .insert(schema.fixedExpenses)
        .values({
          name: args.name,
          amount: amountCents,
          frequency: args.frequency,
          nextDueDate: args.next_due_date,
          category: args.category || null,
          isActive: true,
        })
        .returning();

      return {
        success: true,
        expense: {
          id: result[0].id,
          name: result[0].name,
          amount_dollars: (result[0].amount / 100).toFixed(2),
          frequency: result[0].frequency,
          nextDueDate: result[0].nextDueDate,
          category: result[0].category,
        },
      };
    }

    case "delete_fixed_expense": {
      await db.delete(schema.fixedExpenses).where(eq(schema.fixedExpenses.id, args.expense_id));
      return { success: true, deleted_expense_id: args.expense_id };
    }

    case "add_account": {
      const balanceCents = Math.round(args.balance_dollars * 100);
      const creditLimitCents = args.credit_limit_dollars ? Math.round(args.credit_limit_dollars * 100) : null;
      const result = await db
        .insert(schema.accounts)
        .values({
          name: args.name,
          type: args.type,
          balance: balanceCents,
          creditLimit: creditLimitCents,
          interestRate: args.interest_rate ?? null,
        })
        .returning();
      return {
        success: true,
        account: {
          id: result[0].id,
          name: result[0].name,
          type: result[0].type,
          balance_dollars: (result[0].balance / 100).toFixed(2),
          creditLimit_dollars: result[0].creditLimit ? (result[0].creditLimit / 100).toFixed(2) : null,
        },
      };
    }

    case "delete_account": {
      await db.delete(schema.accounts).where(eq(schema.accounts.id, args.account_id));
      return { success: true, deleted_account_id: args.account_id };
    }

    case "add_income": {
      const amountCents = Math.round(args.amount_dollars * 100);
      const result = await db
        .insert(schema.income)
        .values({
          name: args.name,
          amount: amountCents,
          frequency: args.frequency,
          nextPayDate: args.next_pay_date,
        })
        .returning();
      return {
        success: true,
        income: {
          id: result[0].id,
          name: result[0].name,
          amount_dollars: (result[0].amount / 100).toFixed(2),
          frequency: result[0].frequency,
          nextPayDate: result[0].nextPayDate,
        },
      };
    }

    case "delete_income": {
      await db.delete(schema.income).where(eq(schema.income.id, args.income_id));
      return { success: true, deleted_income_id: args.income_id };
    }

    case "add_bnpl_plan": {
      const result = await db
        .insert(schema.bnplPlans)
        .values({
          bnplAccountId: args.bnpl_account_id,
          itemName: args.item_name,
          totalAmount: Math.round(args.total_amount_dollars * 100),
          instalmentAmount: Math.round(args.instalment_amount_dollars * 100),
          instalmentFrequency: args.instalment_frequency,
          instalmentsTotal: args.instalments_total,
          instalmentsRemaining: args.instalments_remaining,
          nextPaymentDate: args.next_payment_date,
        })
        .returning();
      return {
        success: true,
        plan: {
          id: result[0].id,
          itemName: result[0].itemName,
          totalAmount_dollars: (result[0].totalAmount / 100).toFixed(2),
          instalmentAmount_dollars: (result[0].instalmentAmount / 100).toFixed(2),
          instalmentFrequency: result[0].instalmentFrequency,
          instalmentsTotal: result[0].instalmentsTotal,
          instalmentsRemaining: result[0].instalmentsRemaining,
          nextPaymentDate: result[0].nextPaymentDate,
        },
      };
    }

    case "update_bnpl_plan": {
      const updates: Record<string, unknown> = {};
      if (args.instalments_remaining !== undefined) updates.instalmentsRemaining = args.instalments_remaining;
      if (args.next_payment_date) updates.nextPaymentDate = args.next_payment_date;
      const result = await db
        .update(schema.bnplPlans)
        .set(updates)
        .where(eq(schema.bnplPlans.id, args.plan_id))
        .returning();
      if (result.length === 0) return { error: "BNPL plan not found" };
      return {
        success: true,
        plan: {
          id: result[0].id,
          itemName: result[0].itemName,
          instalmentsRemaining: result[0].instalmentsRemaining,
          nextPaymentDate: result[0].nextPaymentDate,
        },
      };
    }

    case "add_savings_goal": {
      const result = await db
        .insert(schema.savingsGoals)
        .values({
          name: args.name,
          targetAmount: Math.round(args.target_amount_dollars * 100),
          currentAmount: args.current_amount_dollars ? Math.round(args.current_amount_dollars * 100) : 0,
          deadline: args.deadline ?? null,
          priority: args.priority ?? 3,
        })
        .returning();
      return {
        success: true,
        goal: {
          id: result[0].id,
          name: result[0].name,
          targetAmount_dollars: (result[0].targetAmount / 100).toFixed(2),
          currentAmount_dollars: (result[0].currentAmount / 100).toFixed(2),
          deadline: result[0].deadline,
          priority: result[0].priority,
        },
      };
    }

    case "delete_savings_goal": {
      await db.delete(schema.savingsGoals).where(eq(schema.savingsGoals.id, args.goal_id));
      return { success: true, deleted_goal_id: args.goal_id };
    }

    case "delete_wishlist_item": {
      await db.delete(schema.wishlistItems).where(eq(schema.wishlistItems.id, args.item_id));
      return { success: true, deleted_item_id: args.item_id };
    }

    default:
      return { error: `Unknown function: ${name}` };
  }
}

// ── generate UI components from function call results ────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateUIComponents(calledFunctions: { name: string; result: Record<string, unknown> }[]): UIComponent[] {
  const components: UIComponent[] = [];

  for (const { name, result } of calledFunctions) {
    if ("error" in result || "success" in result) continue;
    const r = result as any;

    switch (name) {
      case "get_dashboard_summary": {
        if (r.spendingByCategory?.length > 0) {
          components.push({
            type: "spending_pie_chart",
            title: "This Month's Spending",
            data: {
              segments: r.spendingByCategory.map((s: any) => ({
                category: s.category,
                amount: parseFloat(s.amount_dollars),
              })),
            },
          });
        }
        if (r.bankAccounts?.length > 0 || r.creditCards?.length > 0) {
          components.push({
            type: "accounts_bar_chart",
            title: "Account Balances",
            data: {
              accounts: [
                ...(r.bankAccounts || []).map((a: any) => ({
                  name: a.name, balance: parseFloat(a.balance_dollars), type: "bank",
                })),
                ...(r.creditCards || []).map((a: any) => ({
                  name: a.name, balance: parseFloat(a.balance_dollars), type: "credit_card",
                })),
              ],
            },
          });
        }
        break;
      }

      case "get_accounts": {
        if (r.accounts?.length > 0) {
          components.push({
            type: "accounts_bar_chart",
            title: "Account Balances",
            data: {
              accounts: r.accounts.map((a: any) => ({
                name: a.name,
                balance: parseFloat(a.balance_dollars),
                type: a.type,
              })),
            },
          });
        }
        break;
      }

      case "get_transactions": {
        if (r.transactions?.length > 0) {
          components.push({
            type: "transactions_table",
            title: "Recent Transactions",
            data: {
              transactions: r.transactions.map((t: any) => ({
                id: t.id,
                date: t.date,
                description: t.description,
                amount: parseFloat(t.amount_dollars),
                category: t.category,
                isIncome: t.isIncome,
              })),
            },
          });
        }
        break;
      }

      case "get_bnpl_plans": {
        if (r.plans?.length > 0) {
          components.push({
            type: "bnpl_cards",
            title: "Active BNPL Plans",
            data: {
              plans: r.plans.map((p: any) => ({
                id: p.id,
                provider: p.provider,
                itemName: p.itemName,
                totalAmount: parseFloat(p.totalAmount_dollars),
                instalmentAmount: parseFloat(p.instalmentAmount_dollars),
                frequency: p.frequency,
                instalmentsRemaining: p.instalmentsRemaining,
                instalmentsTotal: p.instalmentsTotal,
                nextPaymentDate: p.nextPaymentDate,
                remainingDebt: parseFloat(p.remainingDebt_dollars),
              })),
            },
          });
        }
        break;
      }

      case "get_wishlist": {
        if (r.items?.length > 0) {
          components.push({
            type: "wishlist_cards",
            title: "Your Wishlist",
            data: {
              items: r.items.map((i: any) => ({
                id: i.id, name: i.name, price: parseFloat(i.price_dollars),
                store: i.store, priority: i.priority, status: i.status, category: i.category,
              })),
            },
          });
        }
        break;
      }

      case "get_savings_goals": {
        if (r.goals?.length > 0) {
          components.push({
            type: "savings_goals_progress",
            title: "Savings Goals",
            data: {
              goals: r.goals.map((g: any) => ({
                id: g.id, name: g.name,
                currentAmount: parseFloat(g.currentAmount_dollars),
                targetAmount: parseFloat(g.targetAmount_dollars),
                progressPercent: parseFloat(g.progress_percent),
                deadline: g.deadline,
              })),
            },
          });
        }
        break;
      }

      case "affordability_check": {
        components.push({
          type: "affordability_verdict",
          title: `Can you afford ${r.item}?`,
          data: {
            item: r.item,
            price: r.price_dollars,
            safeToSpend: parseFloat(r.safeToSpend_dollars),
            canAfford: r.canAffordFromSafeToSpend,
            availableBalance: parseFloat(r.availableBalance_dollars),
            daysUntilPay: r.daysUntilPay,
          },
        });
        break;
      }
    }
  }

  return components;
}

// ── system prompt ────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Mint, a friendly Australian financial assistant embedded in a personal finance app. You help the user understand and manage their money.

PERSONALITY:
- Casual, direct Australian tone. Use "reckon", "mate", "no worries" occasionally.
- Give clear, actionable financial advice without being preachy.
- When showing money data, format amounts nicely (e.g. "$1,234.56").
- Be concise. Don't over-explain. The user is looking at a chat interface.

CAPABILITIES (via function calling):
- View all financial data: accounts, balances, transactions, income, expenses, BNPL plans, wishlist, savings goals
- Create new records: add accounts, income sources, fixed expenses, BNPL plans, savings goals, wishlist items, transactions
- Update records: update balances, savings goals, wishlist items, income, expenses, BNPL plans, individual transactions
- Delete records: delete accounts, income sources, fixed expenses, savings goals, wishlist items
- Bulk categorize transactions: match merchant names and update categories in one go. Also saves merchant mappings for future imports.
- Find recurring/subscription-like transactions by grouping repeated payments.
- Perform affordability checks for items the user wants to buy
- Generate financial summaries and insights

RULES:
- Always use function calls to get real data. NEVER make up numbers.
- When the user asks about their finances, call the relevant function first, then respond with the data.
- When the user asks to change something, call the update function, then confirm what changed.
- All monetary values from functions are in dollars (already converted from cents).
- If you're unsure which account/item the user means, ask for clarification.
- For affordability questions, use the affordability_check function and give a clear yes/no verdict.
- When showing lists of data (accounts, transactions, etc.), format them cleanly.
- Today's date is ${format(new Date(), "yyyy-MM-dd")}.

MULTIMODAL CAPABILITIES:
- You can see images and PDFs that the user uploads in chat.
- RECEIPT SCANNING: When a user uploads a photo of a receipt, examine the image carefully. Extract the merchant name, total amount, and date. Categorise it using the standard categories. Then use add_transaction to insert it. Always confirm what you extracted and what you added.
- BILL UPLOADS: When a user uploads a PDF bill (utility, telco, insurance, etc.), extract the provider name, amount due, due date, and billing frequency. Ask the user "Should I add this to your Fixed Expenses to track for next month?" before calling add_fixed_expense. If they also want it recorded as a transaction, use add_transaction too.
- When adding a transaction from a receipt, you need an account_id. If you don't know which account, call get_accounts first and pick the most likely one (usually the primary bank account), or ask the user.
- For receipts, amounts should be NEGATIVE (they are expenses). Format: -45.50 not 45.50.
- If you can't clearly read the receipt or bill, tell the user what you can see and ask them to confirm the details before adding anything.`;

// ── POST handler ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Convert messages to Gemini format (with multimodal support)
    const contents: Content[] = messages.map(
      (m: {
        role: string;
        content: string;
        attachments?: Array<{ type: string; mimeType: string; data: string; fileName: string }>;
      }) => {
        const parts: Part[] = [];

        // Add file attachments as inlineData parts (before text so Gemini "sees" them first)
        if (m.attachments?.length) {
          for (const att of m.attachments) {
            parts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: att.data,
              },
            });
          }
        }

        parts.push({ text: m.content });

        return {
          role: m.role === "assistant" ? "model" : "user",
          parts,
        };
      }
    );

    const ai = getAI();

    // Start a chat with function calling
    let response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools,
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
      },
    });

    // Handle function calls in a loop
    let iterations = 0;
    const maxIterations = 10;
    const calledFunctions: { name: string; result: Record<string, unknown> }[] = [];
    // Use a mutable history array so we never double-append via spread + push
    const history: Content[] = [...contents];

    while (iterations < maxIterations) {
      const candidate = response.candidates?.[0];
      if (!candidate?.content?.parts) break;

      const functionCalls = candidate.content.parts.filter(
        (p) => p.functionCall
      );

      if (functionCalls.length === 0) break;

      // Execute all function calls in parallel
      const functionResponses: Part[] = await Promise.all(
        functionCalls.map(async (part) => {
          const fc = part.functionCall!;
          const fnName = fc.name ?? "unknown";
          const result = await executeFunction(fnName, (fc.args ?? {}) as Record<string, unknown>);
          calledFunctions.push({ name: fnName, result });
          return {
            functionResponse: {
              name: fnName,
              response: result,
            },
          } as Part;
        })
      );

      // Append model turn + function results to history
      history.push(
        { role: "model" as const, parts: candidate.content.parts as Part[] },
        { role: "user" as const, parts: functionResponses }
      );

      // Send updated history back to Gemini
      response = await ai.models.generateContent({
        model: MODEL,
        contents: history,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools,
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
        },
      });

      iterations++;
    }

    // Extract final text
    const finalCandidate = response.candidates?.[0];
    const rawParts = finalCandidate?.content?.parts?.filter((p) => p.text) ?? [];
    if (rawParts.length === 0) {
      // Log finish reason to help diagnose silent failures
      console.warn("Chat: no text in final response. finish_reason:", finalCandidate?.finishReason, "| calledFns:", calledFunctions.map(f => f.name));
    }
    const finalText = rawParts.map((p) => p.text).join("") || "Sorry, I couldn't generate a response. Please try rephrasing your question.";

    const ui_components = generateUIComponents(calledFunctions);

    return new Response(JSON.stringify({ response: finalText, ui_components }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
