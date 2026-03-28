import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { calculateSafeToSpend } from "@/lib/cashflow";
import { format, addDays, startOfMonth } from "date-fns";
import { getAI, MODEL } from "@/lib/chat-helpers";
import type { UIComponent } from "@/lib/ui-components";

// ── function declarations (tools the AI can call) ────────────
const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_dashboard_summary",
      description: "Get a full financial overview: net position, safe-to-spend, bank balances, credit card debt, BNPL debt, upcoming payments, and spending breakdown for the current month.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_accounts",
      description: "List all bank accounts and credit cards with their current balances.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_account_by_name",
      description: "Find a specific account by name (partial match).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Account name to search for" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_account_balance",
      description: "Update the balance of a bank account or credit card. Amount is in dollars (e.g. 1500.50).",
      parameters: {
        type: "object",
        properties: {
          account_id: { type: "number", description: "The account ID" },
          new_balance_dollars: { type: "number", description: "New balance in dollars" },
        },
        required: ["account_id", "new_balance_dollars"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_transactions",
      description: "Query transactions. Can filter by month (YYYY-MM), category, or search term. Returns most recent first.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "Filter by month YYYY-MM" },
          category: { type: "string", description: "Filter by category" },
          search: { type: "string", description: "Search in transaction descriptions" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_income",
      description: "List all income sources with amounts and frequencies.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "update_income",
      description: "Update an income source's details.",
      parameters: {
        type: "object",
        properties: {
          income_id: { type: "number", description: "The income ID" },
          name: { type: "string", description: "Income source name" },
          amount_dollars: { type: "number", description: "Amount in dollars" },
          frequency: { type: "string", description: "weekly, fortnightly, or monthly" },
          next_pay_date: { type: "string", description: "Next pay date YYYY-MM-DD" },
        },
        required: ["income_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_fixed_expenses",
      description: "List all fixed/recurring expenses (bills, subscriptions, etc.).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "update_fixed_expense",
      description: "Update a fixed expense.",
      parameters: {
        type: "object",
        properties: {
          expense_id: { type: "number", description: "The expense ID" },
          name: { type: "string" },
          amount_dollars: { type: "number" },
          frequency: { type: "string" },
          next_due_date: { type: "string" },
          is_active: { type: "boolean" },
        },
        required: ["expense_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_bnpl_plans",
      description: "List active Buy Now Pay Later plans with remaining instalments.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_bnpl_accounts",
      description: "List BNPL accounts (Afterpay, Zip, etc.) with limits.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_bnpl_agreements",
      description: "List all uploaded Buy Now Pay Later (BNPL) agreements, including their extracted full text terms and conditions. Use this to read the rules, fees, and fine print for a user's BNPL providers.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_wishlist",
      description: "List all wishlist items with prices and statuses.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "update_wishlist_item",
      description: "Update a wishlist item (status, priority, price, etc.).",
      parameters: {
        type: "object",
        properties: {
          item_id: { type: "number", description: "The wishlist item ID" },
          status: { type: "string", description: "wanted, saving, purchased, or archived" },
          priority: { type: "number", description: "1-5" },
          price_dollars: { type: "number" },
          name: { type: "string" },
        },
        required: ["item_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_wishlist_item",
      description: "Add a new item to the wishlist.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Item name" },
          price_dollars: { type: "number", description: "Price in dollars" },
          store: { type: "string", description: "Store name" },
          category: { type: "string" },
          priority: { type: "number", description: "1-5, default 3" },
          notes: { type: "string" },
        },
        required: ["name", "price_dollars"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_savings_goals",
      description: "List all savings goals with progress.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "update_savings_goal",
      description: "Update a savings goal's current amount or target.",
      parameters: {
        type: "object",
        properties: {
          goal_id: { type: "number", description: "The goal ID" },
          current_amount_dollars: { type: "number" },
          target_amount_dollars: { type: "number" },
          name: { type: "string" },
        },
        required: ["goal_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "affordability_check",
      description: "Check whether the user can afford a specific item given their current financial situation. Provide the item name and price.",
      parameters: {
        type: "object",
        properties: {
          item_name: { type: "string", description: "What they want to buy" },
          price_dollars: { type: "number", description: "Price in dollars" },
        },
        required: ["item_name", "price_dollars"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_categorize_transactions",
      description: "Bulk update the category for transactions matching merchant name patterns. Also creates merchant mappings so future imports auto-categorize. Use this when the user wants to categorize multiple transactions at once (e.g. 'categorize all Coles and Woolies as Groceries').",
      parameters: {
        type: "object",
        properties: {
          search_patterns: {
            type: "array",
            items: { type: "string" },
            description: "Merchant name patterns to match (e.g. ['Coles', 'Woolworths', 'Aldi']). Matches against transaction descriptions (case-insensitive).",
          },
          new_category: {
            type: "string",
            description: "Category to assign. Must be one of: Groceries, Dining, Transport, Entertainment, Shopping, Health, Utilities, Rent/Housing, Subscriptions, Insurance, Transfers, Income, Cash Withdrawal, Fees, Other",
          },
          month: {
            type: "string",
            description: "Optional: limit to a specific month (YYYY-MM)",
          },
        },
        required: ["search_patterns", "new_category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_recurring_transactions",
      description: "Find recurring/subscription-like transactions by grouping repeated payments. Great for subscription audits - finds charges that appear multiple times. Returns grouped results with count, total spent, and average amount.",
      parameters: {
        type: "object",
        properties: {
          max_amount_dollars: {
            type: "number",
            description: "Optional: only show recurring charges where average amount is at most this (in dollars). E.g. 20 to find subscriptions under $20.",
          },
          min_occurrences: {
            type: "number",
            description: "Minimum number of times a charge must appear to be considered recurring (default 3).",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_transaction",
      description: "Update a single transaction's category or clean description.",
      parameters: {
        type: "object",
        properties: {
          transaction_id: { type: "number", description: "The transaction ID" },
          category: { type: "string", description: "New category to assign" },
          clean_description: { type: "string", description: "New clean description" },
        },
        required: ["transaction_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_transaction",
      description: "Add a new transaction (e.g. from a receipt scan or manual entry). Amount is in dollars — negative for expenses (e.g. -45.50), positive for income. Requires an account_id — if unsure, call get_accounts first to find the right account.",
      parameters: {
        type: "object",
        properties: {
          account_id: { type: "number", description: "The account ID to add the transaction to" },
          date: { type: "string", description: "Transaction date YYYY-MM-DD" },
          description: { type: "string", description: "Clean merchant/description name" },
          amount_dollars: { type: "number", description: "Amount in dollars. Negative for expenses (e.g. -45.50), positive for income" },
          category: { type: "string", description: "Category: Groceries, Dining, Transport, Entertainment, Shopping, Health, Utilities, Rent/Housing, Subscriptions, Insurance, Transfers, Income, Cash Withdrawal, Fees, Other" },
        },
        required: ["account_id", "date", "description", "amount_dollars", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_fixed_expense",
      description: "Add a new fixed/recurring expense (e.g. from a bill scan). Used for bills, subscriptions, and regular payments the user wants to track.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Expense name (e.g. 'Telstra Mobile', 'AGL Electricity')" },
          amount_dollars: { type: "number", description: "Amount in dollars" },
          frequency: { type: "string", description: "Payment frequency: weekly, fortnightly, monthly, quarterly, yearly" },
          next_due_date: { type: "string", description: "Next due date YYYY-MM-DD" },
          category: { type: "string", description: "Category (e.g. Utilities, Subscriptions, Insurance)" },
        },
        required: ["name", "amount_dollars", "frequency", "next_due_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_fixed_expense",
      description: "Delete / remove a fixed expense permanently.",
      parameters: {
        type: "object",
        properties: {
          expense_id: { type: "number", description: "The expense ID to delete" },
        },
        required: ["expense_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_account",
      description: "Add a new bank account or credit card.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Account name (e.g. 'NAB Savings')" },
          type: { type: "string", description: "Account type: bank or credit_card" },
          balance_dollars: { type: "number", description: "Starting balance in dollars" },
          credit_limit_dollars: { type: "number", description: "Credit card limit in dollars (credit cards only)" },
          interest_rate: { type: "string", description: "Interest rate as string e.g. '19.99'" },
        },
        required: ["name", "type", "balance_dollars"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_account",
      description: "Delete a bank account or credit card permanently.",
      parameters: {
        type: "object",
        properties: {
          account_id: { type: "number", description: "The account ID to delete" },
        },
        required: ["account_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_income",
      description: "Add a new income source (salary, freelance, etc.).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Income source name e.g. 'Freelance Work'" },
          amount_dollars: { type: "number", description: "Amount per pay period in dollars" },
          frequency: { type: "string", description: "weekly, fortnightly, or monthly" },
          next_pay_date: { type: "string", description: "Next pay date YYYY-MM-DD" },
        },
        required: ["name", "amount_dollars", "frequency", "next_pay_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_income",
      description: "Delete an income source permanently.",
      parameters: {
        type: "object",
        properties: {
          income_id: { type: "number", description: "The income ID to delete" },
        },
        required: ["income_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_bnpl_plan",
      description: "Add a new BNPL instalment plan. The user must have an existing BNPL account (use get_bnpl_accounts to find the ID). All amounts in dollars.",
      parameters: {
        type: "object",
        properties: {
          bnpl_account_id: { type: "number", description: "The BNPL account ID (from get_bnpl_accounts)" },
          item_name: { type: "string", description: "What was purchased" },
          total_amount_dollars: { type: "number", description: "Total purchase price in dollars" },
          instalment_amount_dollars: { type: "number", description: "Amount per instalment in dollars" },
          instalment_frequency: { type: "string", description: "weekly, fortnightly, or monthly" },
          instalments_total: { type: "number", description: "Total number of instalments" },
          instalments_remaining: { type: "number", description: "Remaining instalments" },
          next_payment_date: { type: "string", description: "Next payment date YYYY-MM-DD" },
        },
        required: ["bnpl_account_id", "item_name", "total_amount_dollars", "instalment_amount_dollars", "instalment_frequency", "instalments_total", "instalments_remaining", "next_payment_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_bnpl_plan",
      description: "Update a BNPL plan's remaining instalments or next payment date.",
      parameters: {
        type: "object",
        properties: {
          plan_id: { type: "number", description: "The BNPL plan ID" },
          instalments_remaining: { type: "number", description: "New number of instalments remaining" },
          next_payment_date: { type: "string", description: "New next payment date YYYY-MM-DD" },
        },
        required: ["plan_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_savings_goal",
      description: "Create a new savings goal.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Goal name e.g. 'Holiday Fund'" },
          target_amount_dollars: { type: "number", description: "Target amount in dollars" },
          current_amount_dollars: { type: "number", description: "Current saved amount in dollars (default 0)" },
          deadline: { type: "string", description: "Deadline date YYYY-MM-DD (optional)" },
          priority: { type: "number", description: "Priority 1-5 (1=critical, 5=someday, default 3)" },
        },
        required: ["name", "target_amount_dollars"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_savings_goal",
      description: "Delete a savings goal permanently.",
      parameters: {
        type: "object",
        properties: {
          goal_id: { type: "number", description: "The savings goal ID to delete" },
        },
        required: ["goal_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_wishlist_item",
      description: "Remove a wishlist item permanently.",
      parameters: {
        type: "object",
        properties: {
          item_id: { type: "number", description: "The wishlist item ID to delete" },
        },
        required: ["item_id"],
      },
    },
  },
];

// ── function executor ────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeFunction(name: string, args: Record<string, any>): Promise<Record<string, unknown>> {
  const supabase = await createClient();

  switch (name) {
    case "get_dashboard_summary": {
      const today = format(new Date(), "yyyy-MM-dd");
      const in14Days = format(addDays(new Date(), 14), "yyyy-MM-dd");
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

      const [incomesRes, bankRes, ccRes, bnplRes, fixedExpRes, spendingRes] =
        await Promise.all([
          supabase.from("income").select("*"),
          supabase.from("accounts").select("*").eq("type", "bank"),
          supabase.from("accounts").select("*").eq("type", "credit_card"),
          supabase.from("bnpl_plans").select("*, bnpl_accounts!inner(*)").gt("instalments_remaining", 0).eq("bnpl_accounts.is_active", true),
          supabase.from("fixed_expenses").select("*").eq("is_active", true),
          supabase.rpc("monthly_spending_by_category", { start_date: monthStart }),
        ]);

      const incomes = incomesRes.data || [];
      const bankAccounts = bankRes.data || [];
      const creditCards = ccRes.data || [];
      const bnplPlansRaw = bnplRes.data || [];
      const fixedExp = fixedExpRes.data || [];
      const monthlySpending = spendingRes.data || [];

      // Flatten bnpl join results
      const bnplPlansData = bnplPlansRaw.map((p: any) => ({
        id: p.id,
        itemName: p.item_name,
        instalmentAmount: p.instalment_amount,
        instalmentFrequency: p.instalment_frequency,
        instalmentsRemaining: p.instalments_remaining,
        nextPaymentDate: p.next_payment_date,
        provider: p.bnpl_accounts.provider,
      }));

      const totalBankBalance = bankAccounts.reduce((s: number, a: any) => s + a.balance, 0);
      const currentAccountNames = ["current"];
      const isCurrentAccount = (n: string) => currentAccountNames.some((kw) => n.toLowerCase().includes(kw));
      const expenseAccountBalance = bankAccounts.filter((a: any) => isCurrentAccount(a.name)).reduce((s: number, a: any) => s + a.balance, 0);
      const availableBalance = bankAccounts.filter((a: any) => !isCurrentAccount(a.name)).reduce((s: number, a: any) => s + a.balance, 0);
      const totalCreditCardDebt = creditCards.reduce((s: number, a: any) => s + a.balance, 0);
      const totalBnplDebt = bnplPlansData.reduce((s: number, p: any) => s + p.instalmentAmount * p.instalmentsRemaining, 0);
      const netPosition = totalBankBalance - totalCreditCardDebt - totalBnplDebt;

      const sts = calculateSafeToSpend({
        currentBalance: availableBalance,
        incomes: incomes.map((i: any) => ({ name: i.name, amount: i.amount, frequency: i.frequency, nextPayDate: i.next_pay_date })),
        expenses: [],
        bnplPayments: bnplPlansData.map((p: any) => ({
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
        if (exp.next_due_date >= today && exp.next_due_date <= in14Days)
          allUpcoming.push({ name: exp.name, amount: exp.amount, date: exp.next_due_date, type: "expense" });
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
        spendingByCategory: monthlySpending.map((s: any) => ({ category: s.category || "Uncategorised", amount_dollars: (Number(s.total) / 100).toFixed(2) })),
        bankAccounts: bankAccounts.map((a: any) => ({ id: a.id, name: a.name, balance_dollars: (a.balance / 100).toFixed(2) })),
        creditCards: creditCards.map((c: any) => ({ id: c.id, name: c.name, balance_dollars: (c.balance / 100).toFixed(2), limit_dollars: c.credit_limit ? (c.credit_limit / 100).toFixed(2) : null })),
      };
    }

    case "get_accounts": {
      const { data: rows } = await supabase.from("accounts").select("*").order("name");
      return {
        accounts: (rows || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          balance_dollars: (a.balance / 100).toFixed(2),
          creditLimit_dollars: a.credit_limit ? (a.credit_limit / 100).toFixed(2) : null,
          interestRate: a.interest_rate,
        })),
      };
    }

    case "get_account_by_name": {
      const { data: rows } = await supabase.from("accounts").select("*").ilike("name", `%${args.name}%`);
      return {
        accounts: (rows || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          balance_dollars: (a.balance / 100).toFixed(2),
          creditLimit_dollars: a.credit_limit ? (a.credit_limit / 100).toFixed(2) : null,
        })),
      };
    }

    case "update_account_balance": {
      const cents = Math.round(args.new_balance_dollars * 100);
      const { data } = await supabase.from("accounts").update({ balance: cents }).eq("id", args.account_id).select();
      if (!data || data.length === 0) return { error: "Account not found" };
      return { success: true, account: { id: data[0].id, name: data[0].name, new_balance_dollars: (data[0].balance / 100).toFixed(2) } };
    }

    case "get_transactions": {
      let query = supabase.from("transactions").select("*");
      if (args.month) query = query.eq("statement_month", args.month);
      if (args.category) query = query.eq("category", args.category);
      if (args.search) query = query.ilike("clean_description", `%${args.search}%`);
      query = query.order("date", { ascending: false }).limit(args.limit || 20);

      const { data: rows } = await query;
      return {
        transactions: (rows || []).map((t: any) => ({
          id: t.id,
          date: t.date,
          description: t.clean_description || t.raw_description,
          amount_dollars: (t.amount / 100).toFixed(2),
          category: t.category,
          isIncome: t.is_income,
        })),
        count: (rows || []).length,
      };
    }

    case "get_income": {
      const { data: rows } = await supabase.from("income").select("*").order("name");
      return {
        incomes: (rows || []).map((i: any) => ({
          id: i.id,
          name: i.name,
          amount_dollars: (i.amount / 100).toFixed(2),
          frequency: i.frequency,
          nextPayDate: i.next_pay_date,
        })),
      };
    }

    case "update_income": {
      const updates: Record<string, unknown> = {};
      if (args.name) updates.name = args.name;
      if (args.amount_dollars) updates.amount = Math.round(args.amount_dollars * 100);
      if (args.frequency) updates.frequency = args.frequency;
      if (args.next_pay_date) updates.next_pay_date = args.next_pay_date;
      const { data } = await supabase.from("income").update(updates).eq("id", args.income_id).select();
      if (!data || data.length === 0) return { error: "Income not found" };
      return { success: true, income: { id: data[0].id, name: data[0].name, amount_dollars: (data[0].amount / 100).toFixed(2) } };
    }

    case "get_fixed_expenses": {
      const { data: rows } = await supabase.from("fixed_expenses").select("*").order("name");
      return {
        expenses: (rows || []).map((e: any) => ({
          id: e.id,
          name: e.name,
          amount_dollars: (e.amount / 100).toFixed(2),
          frequency: e.frequency,
          nextDueDate: e.next_due_date,
          category: e.category,
          isActive: e.is_active,
        })),
      };
    }

    case "update_fixed_expense": {
      const updates: Record<string, unknown> = {};
      if (args.name) updates.name = args.name;
      if (args.amount_dollars !== undefined) updates.amount = Math.round(args.amount_dollars * 100);
      if (args.frequency) updates.frequency = args.frequency;
      if (args.next_due_date) updates.next_due_date = args.next_due_date;
      if (args.is_active !== undefined) updates.is_active = args.is_active;
      const { data } = await supabase.from("fixed_expenses").update(updates).eq("id", args.expense_id).select();
      if (!data || data.length === 0) return { error: "Expense not found" };
      return { success: true, expense: { id: data[0].id, name: data[0].name, amount_dollars: (data[0].amount / 100).toFixed(2) } };
    }

    case "get_bnpl_plans": {
      const { data: rows } = await supabase
        .from("bnpl_plans")
        .select("*, bnpl_accounts!inner(*)")
        .gt("instalments_remaining", 0);
      return {
        plans: (rows || []).map((p: any) => ({
          id: p.id,
          provider: p.bnpl_accounts.provider,
          itemName: p.item_name,
          totalAmount_dollars: (p.total_amount / 100).toFixed(2),
          instalmentAmount_dollars: (p.instalment_amount / 100).toFixed(2),
          frequency: p.instalment_frequency,
          instalmentsRemaining: p.instalments_remaining,
          instalmentsTotal: p.instalments_total,
          nextPaymentDate: p.next_payment_date,
          remainingDebt_dollars: ((p.instalment_amount * p.instalments_remaining) / 100).toFixed(2),
        })),
      };
    }

    case "get_bnpl_accounts": {
      const { data: rows } = await supabase.from("bnpl_accounts").select("*").eq("is_active", true);
      return {
        accounts: (rows || []).map((a: any) => ({
          id: a.id,
          provider: a.provider,
          spendingLimit_dollars: (a.spending_limit / 100).toFixed(2),
          availableLimit_dollars: (a.available_limit / 100).toFixed(2),
        })),
      };
    }

    case "get_bnpl_agreements": {
      const { data: rows } = await supabase.from("bnpl_agreements").select("*");
      return {
        agreements: (rows || []).map((a: any) => ({
          id: a.id,
          provider: a.provider,
          fileName: a.file_name,
          extractedText: a.extracted_text,
          notes: a.notes,
        })),
      };
    }

    case "get_wishlist": {
      const { data: rows } = await supabase.from("wishlist_items").select("*").order("priority");
      return {
        items: (rows || []).map((i: any) => ({
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
      const { data } = await supabase.from("wishlist_items").update(updates).eq("id", args.item_id).select();
      if (!data || data.length === 0) return { error: "Item not found" };
      return { success: true, item: { id: data[0].id, name: data[0].name, status: data[0].status, price_dollars: (data[0].price / 100).toFixed(2) } };
    }

    case "add_wishlist_item": {
      const { data } = await supabase
        .from("wishlist_items")
        .insert({
          name: args.name,
          price: Math.round(args.price_dollars * 100),
          store: args.store ?? null,
          category: args.category ?? null,
          priority: args.priority ?? 3,
          notes: args.notes ?? null,
          status: "wanted",
          date_added: format(new Date(), "yyyy-MM-dd"),
        })
        .select();
      return { success: true, item: { id: data![0].id, name: data![0].name, price_dollars: (data![0].price / 100).toFixed(2) } };
    }

    case "get_savings_goals": {
      const { data: rows } = await supabase.from("savings_goals").select("*").order("priority");
      return {
        goals: (rows || []).map((g: any) => ({
          id: g.id,
          name: g.name,
          currentAmount_dollars: (g.current_amount / 100).toFixed(2),
          targetAmount_dollars: (g.target_amount / 100).toFixed(2),
          progress_percent: g.target_amount > 0 ? ((g.current_amount / g.target_amount) * 100).toFixed(1) : "0",
          deadline: g.deadline,
        })),
      };
    }

    case "update_savings_goal": {
      const updates: Record<string, unknown> = {};
      if (args.name) updates.name = args.name;
      if (args.current_amount_dollars !== undefined) updates.current_amount = Math.round(args.current_amount_dollars * 100);
      if (args.target_amount_dollars !== undefined) updates.target_amount = Math.round(args.target_amount_dollars * 100);
      const { data } = await supabase.from("savings_goals").update(updates).eq("id", args.goal_id).select();
      if (!data || data.length === 0) return { error: "Goal not found" };
      return {
        success: true,
        goal: {
          id: data[0].id,
          name: data[0].name,
          currentAmount_dollars: (data[0].current_amount / 100).toFixed(2),
          targetAmount_dollars: (data[0].target_amount / 100).toFixed(2),
        },
      };
    }

    case "affordability_check": {
      const [incomesRes, bankRes, ccRes, bnplRes] = await Promise.all([
        supabase.from("income").select("*"),
        supabase.from("accounts").select("*").eq("type", "bank"),
        supabase.from("accounts").select("*").eq("type", "credit_card"),
        supabase.from("bnpl_plans").select("*, bnpl_accounts!inner(*)").gt("instalments_remaining", 0).eq("bnpl_accounts.is_active", true),
      ]);

      const incomes = incomesRes.data || [];
      const bankAccounts = bankRes.data || [];
      const creditCards = ccRes.data || [];
      const bnplPlansData = (bnplRes.data || []).map((p: any) => ({
        instalmentAmount: p.instalment_amount,
        instalmentsRemaining: p.instalments_remaining,
      }));

      const totalBank = bankAccounts.reduce((s: number, a: any) => s + a.balance, 0);
      const ccDebt = creditCards.reduce((s: number, a: any) => s + a.balance, 0);
      const bnplDebt = bnplPlansData.reduce((s: number, p: any) => s + p.instalmentAmount * p.instalmentsRemaining, 0);
      const currentAccountNames = ["current"];
      const isCurrentAccount = (n: string) => currentAccountNames.some((kw) => n.toLowerCase().includes(kw));
      const available = bankAccounts.filter((a: any) => !isCurrentAccount(a.name)).reduce((s: number, a: any) => s + a.balance, 0);

      const sts = calculateSafeToSpend({
        currentBalance: available,
        incomes: incomes.map((i: any) => ({ name: i.name, amount: i.amount, frequency: i.frequency, nextPayDate: i.next_pay_date })),
        expenses: [],
        bnplPayments: [],
        creditCards: [],
      });

      const priceCents = Math.round(args.price_dollars * 100);
      const monthlyIncome = incomes.reduce((s: number, i: any) => {
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
        // Find matching transactions
        let query = supabase
          .from("transactions")
          .select("id, clean_description, raw_description, category")
          .or(`clean_description.ilike.%${pattern}%,raw_description.ilike.%${pattern}%`);
        if (month) query = query.eq("statement_month", month);

        const { data: matching } = await query;

        if (matching && matching.length > 0) {
          // Update all matching transactions
          const ids = matching.map((t: any) => t.id);
          await supabase
            .from("transactions")
            .update({ category: newCategory })
            .in("id", ids);

          for (const t of matching) {
            updatedTransactions.push({
              id: t.id,
              description: t.clean_description || t.raw_description,
              old_category: t.category,
              new_category: newCategory,
            });
          }
          totalUpdated += matching.length;
        }

        // Create/update merchant mapping for future imports
        const { data: existingMapping } = await supabase
          .from("merchant_mappings")
          .select("*")
          .eq("raw_pattern", pattern.toLowerCase());

        if (!existingMapping || existingMapping.length === 0) {
          await supabase.from("merchant_mappings").insert({
            raw_pattern: pattern.toLowerCase(),
            clean_name: pattern,
            category: newCategory,
          });
        } else {
          await supabase
            .from("merchant_mappings")
            .update({ category: newCategory, clean_name: pattern })
            .eq("raw_pattern", pattern.toLowerCase());
        }
      }

      return {
        success: true,
        updated_count: totalUpdated,
        patterns_matched: patterns,
        new_category: newCategory,
        transactions: updatedTransactions.slice(0, 50),
        mappings_created: patterns.length,
        note: totalUpdated > 50 ? `Showing first 50 of ${totalUpdated} updated transactions` : undefined,
      };
    }

    case "find_recurring_transactions": {
      const minOccurrences = args.min_occurrences || 3;
      const maxAmountCents = args.max_amount_dollars ? Math.round(args.max_amount_dollars * 100) : null;

      // Use RPC for GROUP BY query
      const { data: results } = await supabase.rpc("recurring_transactions" as any, { min_count: minOccurrences });

      let filtered = results || [];
      if (maxAmountCents) {
        filtered = filtered.filter((r: any) => Number(r.avg_amount) <= maxAmountCents);
      }

      return {
        recurring_transactions: filtered.map((r: any) => ({
          description: r.description || "Unknown",
          category: r.category || "Uncategorised",
          occurrences: Number(r.count),
          total_spent_dollars: (Number(r.total_spent) / 100).toFixed(2),
          avg_amount_dollars: (Number(r.avg_amount) / 100).toFixed(2),
          first_seen: r.first_date,
          last_seen: r.last_date,
        })),
        total_groups: filtered.length,
      };
    }

    case "update_transaction": {
      const updates: Record<string, unknown> = {};
      if (args.category) updates.category = args.category;
      if (args.clean_description) updates.clean_description = args.clean_description;
      const { data } = await supabase
        .from("transactions")
        .update(updates)
        .eq("id", args.transaction_id)
        .select();
      if (!data || data.length === 0) return { error: "Transaction not found" };
      return {
        success: true,
        transaction: {
          id: data[0].id,
          description: data[0].clean_description || data[0].raw_description,
          category: data[0].category,
          amount_dollars: (data[0].amount / 100).toFixed(2),
        },
      };
    }

    case "add_transaction": {
      const amountCents = Math.round(args.amount_dollars * 100);
      const today = format(new Date(), "yyyy-MM-dd");
      const date = args.date || today;
      const statementMonth = date.substring(0, 7);

      const { data } = await supabase
        .from("transactions")
        .insert({
          account_id: args.account_id,
          date,
          raw_description: args.description,
          clean_description: args.description,
          amount: amountCents,
          category: args.category,
          is_income: amountCents > 0,
          is_reviewed: true,
          statement_month: statementMonth,
        })
        .select();

      return {
        success: true,
        transaction: {
          id: data![0].id,
          date: data![0].date,
          description: data![0].clean_description,
          amount_dollars: (data![0].amount / 100).toFixed(2),
          category: data![0].category,
        },
      };
    }

    case "add_fixed_expense": {
      const amountCents = Math.round(args.amount_dollars * 100);

      const { data } = await supabase
        .from("fixed_expenses")
        .insert({
          name: args.name,
          amount: amountCents,
          frequency: args.frequency,
          next_due_date: args.next_due_date,
          category: args.category || null,
          is_active: true,
        })
        .select();

      return {
        success: true,
        expense: {
          id: data![0].id,
          name: data![0].name,
          amount_dollars: (data![0].amount / 100).toFixed(2),
          frequency: data![0].frequency,
          nextDueDate: data![0].next_due_date,
          category: data![0].category,
        },
      };
    }

    case "delete_fixed_expense": {
      await supabase.from("fixed_expenses").delete().eq("id", args.expense_id);
      return { success: true, deleted_expense_id: args.expense_id };
    }

    case "add_account": {
      const balanceCents = Math.round(args.balance_dollars * 100);
      const creditLimitCents = args.credit_limit_dollars ? Math.round(args.credit_limit_dollars * 100) : null;
      const { data } = await supabase
        .from("accounts")
        .insert({
          name: args.name,
          type: args.type,
          balance: balanceCents,
          credit_limit: creditLimitCents,
          interest_rate: args.interest_rate ?? null,
        })
        .select();
      return {
        success: true,
        account: {
          id: data![0].id,
          name: data![0].name,
          type: data![0].type,
          balance_dollars: (data![0].balance / 100).toFixed(2),
          creditLimit_dollars: data![0].credit_limit ? (data![0].credit_limit / 100).toFixed(2) : null,
        },
      };
    }

    case "delete_account": {
      await supabase.from("accounts").delete().eq("id", args.account_id);
      return { success: true, deleted_account_id: args.account_id };
    }

    case "add_income": {
      const amountCents = Math.round(args.amount_dollars * 100);
      const { data } = await supabase
        .from("income")
        .insert({
          name: args.name,
          amount: amountCents,
          frequency: args.frequency,
          next_pay_date: args.next_pay_date,
        })
        .select();
      return {
        success: true,
        income: {
          id: data![0].id,
          name: data![0].name,
          amount_dollars: (data![0].amount / 100).toFixed(2),
          frequency: data![0].frequency,
          nextPayDate: data![0].next_pay_date,
        },
      };
    }

    case "delete_income": {
      await supabase.from("income").delete().eq("id", args.income_id);
      return { success: true, deleted_income_id: args.income_id };
    }

    case "add_bnpl_plan": {
      const { data } = await supabase
        .from("bnpl_plans")
        .insert({
          bnpl_account_id: args.bnpl_account_id,
          item_name: args.item_name,
          total_amount: Math.round(args.total_amount_dollars * 100),
          instalment_amount: Math.round(args.instalment_amount_dollars * 100),
          instalment_frequency: args.instalment_frequency,
          instalments_total: args.instalments_total,
          instalments_remaining: args.instalments_remaining,
          next_payment_date: args.next_payment_date,
        })
        .select();
      return {
        success: true,
        plan: {
          id: data![0].id,
          itemName: data![0].item_name,
          totalAmount_dollars: (data![0].total_amount / 100).toFixed(2),
          instalmentAmount_dollars: (data![0].instalment_amount / 100).toFixed(2),
          instalmentFrequency: data![0].instalment_frequency,
          instalmentsTotal: data![0].instalments_total,
          instalmentsRemaining: data![0].instalments_remaining,
          nextPaymentDate: data![0].next_payment_date,
        },
      };
    }

    case "update_bnpl_plan": {
      const updates: Record<string, unknown> = {};
      if (args.instalments_remaining !== undefined) updates.instalments_remaining = args.instalments_remaining;
      if (args.next_payment_date) updates.next_payment_date = args.next_payment_date;
      const { data } = await supabase
        .from("bnpl_plans")
        .update(updates)
        .eq("id", args.plan_id)
        .select();
      if (!data || data.length === 0) return { error: "BNPL plan not found" };
      return {
        success: true,
        plan: {
          id: data[0].id,
          itemName: data[0].item_name,
          instalmentsRemaining: data[0].instalments_remaining,
          nextPaymentDate: data[0].next_payment_date,
        },
      };
    }

    case "add_savings_goal": {
      const { data } = await supabase
        .from("savings_goals")
        .insert({
          name: args.name,
          target_amount: Math.round(args.target_amount_dollars * 100),
          current_amount: args.current_amount_dollars ? Math.round(args.current_amount_dollars * 100) : 0,
          deadline: args.deadline ?? null,
          priority: args.priority ?? 3,
        })
        .select();
      return {
        success: true,
        goal: {
          id: data![0].id,
          name: data![0].name,
          targetAmount_dollars: (data![0].target_amount / 100).toFixed(2),
          currentAmount_dollars: (data![0].current_amount / 100).toFixed(2),
          deadline: data![0].deadline,
          priority: data![0].priority,
        },
      };
    }

    case "delete_savings_goal": {
      await supabase.from("savings_goals").delete().eq("id", args.goal_id);
      return { success: true, deleted_goal_id: args.goal_id };
    }

    case "delete_wishlist_item": {
      await supabase.from("wishlist_items").delete().eq("id", args.item_id);
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
- View all financial data: accounts, balances, transactions, income, expenses, BNPL plans, BNPL agreements, wishlist, savings goals
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

    // Convert messages to OpenAI format (with multimodal support)
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map(
        (m: {
          role: string;
          content: string;
          attachments?: Array<{ type: string; mimeType: string; data: string; fileName: string }>;
        }): OpenAI.ChatCompletionMessageParam => {
          const role = m.role === "assistant" ? "assistant" : "user";

          // If there are attachments, build a multipart content array
          if (m.attachments?.length && role === "user") {
            const parts: OpenAI.ChatCompletionContentPart[] = [];
            for (const att of m.attachments) {
              parts.push({
                type: "image_url",
                image_url: { url: `data:${att.mimeType};base64,${att.data}` },
              });
            }
            parts.push({ type: "text", text: m.content });
            return { role: "user", content: parts };
          }

          return { role, content: m.content };
        }
      ),
    ];

    const ai = getAI();
    const calledFunctions: { name: string; result: Record<string, unknown> }[] = [];
    const history: OpenAI.ChatCompletionMessageParam[] = [...openaiMessages];

    // Initial call
    let response = await ai.chat.completions.create({
      model: MODEL,
      messages: history,
      tools,
      tool_choice: "auto",
    });

    // Handle function calls in a loop
    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      const message = response.choices[0]?.message;
      if (!message) break;

      const toolCalls = message.tool_calls;
      if (!toolCalls || toolCalls.length === 0) break;

      // Append assistant message with tool calls to history
      history.push(message);

      // Execute all tool calls in parallel
      const toolResults = await Promise.all(
        toolCalls.map(async (tc) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tcAny = tc as any;
          const fnName: string = tcAny.function?.name ?? "unknown";
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tcAny.function?.arguments || "{}");
          } catch {
            args = {};
          }
          const result = await executeFunction(fnName, args);
          calledFunctions.push({ name: fnName, result });
          return {
            role: "tool" as const,
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          };
        })
      );

      // Append tool results to history
      history.push(...toolResults);

      // Continue conversation
      response = await ai.chat.completions.create({
        model: MODEL,
        messages: history,
        tools,
        tool_choice: "auto",
      });

      iterations++;
    }

    // Extract final text
    const finalMessage = response.choices[0]?.message;
    const finalText =
      finalMessage?.content ||
      "Sorry, I couldn't generate a response. Please try rephrasing your question.";

    if (!finalMessage?.content) {
      console.warn(
        "Chat: no text in final response. finish_reason:",
        response.choices[0]?.finish_reason,
        "| calledFns:",
        calledFunctions.map((f) => f.name)
      );
    }

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
