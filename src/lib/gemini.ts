import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export type TaskType = "categorise" | "advise" | "report" | "cleanup" | "prioritise";

const MODEL_MAP: Record<TaskType, string> = {
  categorise: "gemini-2.5-flash",
  cleanup: "gemini-2.5-flash",
  advise: "gemini-2.5-pro",
  report: "gemini-2.5-pro",
  prioritise: "gemini-2.5-pro",
};

export interface CategorisationResult {
  rawDescription: string;
  cleanName: string;
  category: string;
}

export interface PurchaseAdvice {
  recommendation: string;
  reasoning: string;
  bestStrategy: string;
  risks: string[];
  tips: string[];
}

export interface MonthlyReport {
  summary: string;
  highlights: string[];
  anomalies: string[];
  suggestions: string[];
  healthScore: number;
}

export async function categoriseTransactions(
  descriptions: string[]
): Promise<CategorisationResult[]> {
  const prompt = `You are a financial transaction categoriser for an Australian bank account.

Given these transaction descriptions, return a JSON array where each item has:
- "rawDescription": the original description
- "cleanName": a clean, human-readable merchant/payee name
- "category": one of: Groceries, Dining, Transport, Entertainment, Shopping, Health, Utilities, Rent/Housing, Subscriptions, Insurance, Transfers, Income, Cash Withdrawal, Fees, Other

Transaction descriptions:
${descriptions.map((d, i) => `${i + 1}. ${d}`).join("\n")}

Return ONLY valid JSON array, no markdown formatting.`;

  const response = await ai.models.generateContent({
    model: MODEL_MAP.categorise,
    contents: prompt,
  });

  const text = response.text || "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

export async function getPurchaseAdvice(context: {
  item: string;
  price: number;
  financialSnapshot: object;
  strategies: object[];
  savingsGoals: object[];
  urgency?: string;
}): Promise<PurchaseAdvice> {
  const prompt = `You are a friendly Australian financial advisor helping someone decide how to buy something.

The person wants to buy: ${context.item} for $${(context.price / 100).toFixed(2)}
Urgency: ${context.urgency || "not specified"}

Their financial snapshot:
${JSON.stringify(context.financialSnapshot, null, 2)}

Payment strategies calculated (all costs already computed, DO NOT recalculate):
${JSON.stringify(context.strategies, null, 2)}

Their savings goals:
${JSON.stringify(context.savingsGoals, null, 2)}

Based on these pre-calculated results, recommend the best payment approach. Be direct, casual, and Australian in tone. Consider:
1. Total cost (fees/interest)
2. Cashflow impact (will any week be dangerously low?)
3. Impact on savings goals
4. Risks

Return JSON with:
- "recommendation": your top recommendation in 1-2 sentences
- "reasoning": detailed explanation (2-3 paragraphs)
- "bestStrategy": the strategy name
- "risks": array of risk strings
- "tips": array of helpful tips

Return ONLY valid JSON, no markdown.`;

  const response = await ai.models.generateContent({
    model: MODEL_MAP.advise,
    contents: prompt,
  });

  const text = response.text || "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

export async function generateMonthlyReport(context: {
  month: string;
  categoryTotals: Record<string, number>;
  previousMonthTotals: Record<string, number>;
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  bnplExposure: number;
  previousBnplExposure: number;
  anomalies: string[];
}): Promise<MonthlyReport> {
  const prompt = `You are a friendly Australian financial advisor writing a monthly money report.

Month: ${context.month}

Income: $${(context.totalIncome / 100).toFixed(2)}
Expenses: $${(context.totalExpenses / 100).toFixed(2)}
Savings rate: ${context.savingsRate.toFixed(1)}%

Spending by category (this month vs last month):
${Object.entries(context.categoryTotals)
  .map(
    ([cat, amount]) =>
      `- ${cat}: $${(amount / 100).toFixed(2)} (last month: $${((context.previousMonthTotals[cat] || 0) / 100).toFixed(2)})`
  )
  .join("\n")}

BNPL exposure: $${(context.bnplExposure / 100).toFixed(2)} (was $${(context.previousBnplExposure / 100).toFixed(2)})

Anomalies detected by our system:
${context.anomalies.length ? context.anomalies.join("\n") : "None"}

Write a casual, helpful monthly report. Be direct. Return JSON with:
- "summary": 2-3 paragraph narrative summary
- "highlights": array of key highlights
- "anomalies": array of things that stood out
- "suggestions": array of actionable suggestions
- "healthScore": 1-100 overall financial health score

Return ONLY valid JSON, no markdown.`;

  const response = await ai.models.generateContent({
    model: MODEL_MAP.report,
    contents: prompt,
  });

  const text = response.text || "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

export interface BnplAdvisorResult {
  items: {
    itemId: number;
    itemName: string;
    price: number;
    canAfford: boolean;
    recommendation: "buy_cash" | "use_afterpay" | "use_zip_pay" | "save_up" | "wait" | "skip";
    recommendedProvider: string | null;
    reasoning: string;
    paymentBreakdown: string;
    warnings: string[];
  }[];
  overallSummary: string;
  bnplHealthCheck: string;
}

export async function adviseWishlistBnpl(context: {
  items: { id: number; name: string; price: number; priority: number; category: string | null; notes: string | null; status: string; store: string | null }[];
  financialSnapshot: {
    totalBankBalance: number;
    safeToSpend: number;
    totalCreditCardDebt: number;
    totalBnplDebt: number;
    netPosition: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    monthlySurplus: number;
    daysUntilPay: number;
  };
  bnplAccounts: {
    provider: string;
    spendingLimit: number;
    availableLimit: number;
    isActive: boolean;
  }[];
  existingBnplPlans: {
    provider: string;
    itemName: string;
    remainingAmount: number;
    instalmentsRemaining: number;
  }[];
  savingsGoals: { name: string; target: number; current: number; progress: string }[];
}): Promise<BnplAdvisorResult> {
  const prompt = `You are a sharp Australian financial advisor specialising in Buy Now Pay Later services. You're helping someone decide which wishlist items to buy and the smartest way to pay.

IMPORTANT BNPL PROVIDER RULES (use these exact rules):

**Afterpay:**
- 4 equal fortnightly payments over 6 weeks
- ALWAYS interest-free, no annual fees
- Late fees: capped at 25% of order value or $68, whichever is LESS (e.g. $40 order = max $10 late fee)
- Best for: purchases under $2,000 that you want to split over 6 weeks
- First payment due at time of purchase (25% upfront)

**Zip Pay:**
- Flexible repayments (minimum $40/month or 3% of balance, whichever is greater)
- NO interest charged if balance is $1,500 or less at end of month
- If balance exceeds $1,500: interest applies
- Monthly account fee of $9.95 if balance is NOT paid in full by end of month
- Credit limit up to $2,000
- Best for: purchases you want flexible repayment terms on, especially if you can keep balance under $1,500

Their wishlist items:
${context.items.map((i, idx) => `${idx + 1}. "${i.name}" - $${i.price.toFixed(2)} (priority: ${i.priority}/5, store: ${i.store || "unknown"}, category: ${i.category || "uncategorised"}, status: ${i.status})`).join("\n")}

Financial snapshot:
${JSON.stringify(context.financialSnapshot, null, 2)}

Active BNPL accounts:
${context.bnplAccounts.length > 0 ? context.bnplAccounts.map(a => `- ${a.provider}: $${a.availableLimit.toFixed(2)} available of $${a.spendingLimit.toFixed(2)} limit`).join("\n") : "No active BNPL accounts"}

Existing BNPL plans (current commitments):
${context.existingBnplPlans.length > 0 ? context.existingBnplPlans.map(p => `- ${p.provider}: ${p.itemName} - $${p.remainingAmount.toFixed(2)} remaining (${p.instalmentsRemaining} payments left)`).join("\n") : "No existing plans"}

Savings goals:
${context.savingsGoals.length > 0 ? context.savingsGoals.map(g => `- ${g.name}: $${g.current.toFixed(2)} / $${g.target.toFixed(2)} (${g.progress})`).join("\n") : "No savings goals"}

For each item, analyse whether they can afford it and the best payment method. Consider:
1. Can they afford it outright (cash)?
2. Would Afterpay be suitable? (4 fortnightly payments, interest-free)
3. Would Zip Pay be suitable? (flexible repayments, interest-free under $1,500 balance)
4. Should they save up instead?
5. What's the impact on their existing BNPL exposure and cashflow?

Be direct, casual, and Australian. Don't sugarcoat if they can't afford something.

Return JSON with:
- "items": array of { "itemId": number, "itemName": string, "price": number, "canAfford": boolean, "recommendation": one of "buy_cash"|"use_afterpay"|"use_zip_pay"|"save_up"|"wait"|"skip", "recommendedProvider": string or null, "reasoning": string (2-3 sentences), "paymentBreakdown": string (e.g. "4 x $75.00 fortnightly with Afterpay"), "warnings": array of risk strings }
- "overallSummary": a paragraph of overall advice about their wishlist spending and BNPL usage
- "bnplHealthCheck": a sentence about their current BNPL health (exposure level, risk)

Return ONLY valid JSON, no markdown.`;

  const response = await ai.models.generateContent({
    model: MODEL_MAP.advise,
    contents: prompt,
  });

  const text = response.text || "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

export interface AffordabilityAdvice {
  verdict: "yes_cash" | "yes_zip" | "yes_save_short" | "not_yet";
  headline: string;
  explanation: string;
  zipStrategy: string | null;
  monthlyImpact: string;
  warnings: string[];
  timeframe: string;
}

export async function getAffordabilityAdvice(context: {
  item: { name: string; price: number; store: string | null };
  financialSnapshot: {
    totalBankBalance: number;
    safeToSpend: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    monthlySurplus: number;
    totalCreditCardDebt: number;
    totalBnplDebt: number;
    netPosition: number;
    daysUntilPay: number;
  };
  zipAccount: {
    currentBalance: number;
    spendingLimit: number;
    availableLimit: number;
  } | null;
  existingBnplPlans: {
    provider: string;
    itemName: string;
    remainingAmount: number;
    monthlyPayment: number;
  }[];
}): Promise<AffordabilityAdvice> {
  const { item, financialSnapshot: fs, zipAccount, existingBnplPlans } = context;
  const price = item.price.toFixed(2);

  const zipSection = zipAccount
    ? `ZIP PAY/MONEY ACCOUNT:
- Current Zip balance: $${zipAccount.currentBalance.toFixed(2)}
- Spending limit: $${zipAccount.spendingLimit.toFixed(2)}
- Available limit: $${zipAccount.availableLimit.toFixed(2)}
- CRITICAL RULE: No interest charged as long as total Zip balance stays UNDER $1,500
- If this purchase pushes Zip balance over $1,500, interest kicks in
- User's personal repayment rule: $100/month minimum payment
- Balance after this purchase would be: $${(zipAccount.currentBalance + item.price).toFixed(2)}
- Months to pay off at $100/month: ${Math.ceil((zipAccount.currentBalance + item.price) / 100)}`
    : "ZIP ACCOUNT: No Zip account set up.";

  const plansSection =
    existingBnplPlans.length > 0
      ? existingBnplPlans
          .map(
            (p) =>
              `- ${p.provider}: ${p.itemName} - $${p.remainingAmount.toFixed(2)} remaining (~$${p.monthlyPayment.toFixed(2)}/month)`
          )
          .join("\n")
      : "None";

  const prompt = `You are a sharp, casual Australian financial advisor. Someone is asking "Can I afford this?"

They want: "${item.name}" for $${price}${item.store ? ` from ${item.store}` : ""}

THEIR FINANCIAL SITUATION:
- Monthly income: $${fs.monthlyIncome.toFixed(2)}
- Monthly expenses (fixed): $${fs.monthlyExpenses.toFixed(2)}
- Monthly surplus (savings capacity): $${fs.monthlySurplus.toFixed(2)}
- Bank balance right now: $${fs.totalBankBalance.toFixed(2)}
- Safe to spend this pay cycle: $${fs.safeToSpend.toFixed(2)} (${fs.daysUntilPay} days until payday)
- Credit card debt: $${fs.totalCreditCardDebt.toFixed(2)}
- Total BNPL debt: $${fs.totalBnplDebt.toFixed(2)}
- Net position: $${fs.netPosition.toFixed(2)}

${zipSection}

EXISTING BNPL COMMITMENTS:
${plansSection}

ANALYSIS REQUIRED:
1. Can they afford this from cash/savings without straining their budget?
2. If not cash, can they use Zip Pay and keep the balance under $1,500 (interest-free)?
3. How many months at $100/month to pay it off via Zip?
4. What's the real monthly impact on their budget?
5. Are there any red flags (too much BNPL exposure, eating into emergency funds)?

Be direct. Give a clear yes/no verdict first, then explain.

Return JSON with:
- "verdict": one of "yes_cash" | "yes_zip" | "yes_save_short" | "not_yet"
  - yes_cash = can afford to pay outright
  - yes_zip = can afford via Zip Pay interest-free (balance stays under $1,500)
  - yes_save_short = could afford within 1-3 months of saving
  - not_yet = not affordable right now without significant strain
- "headline": catchy 1-liner verdict (casual Australian tone)
- "explanation": 2-3 paragraphs with the reasoning
- "zipStrategy": if Zip is recommended, explain the repayment plan (e.g. "$100/month for 5 months, balance stays under $1,500 interest-free"). null if not applicable
- "monthlyImpact": clear statement of monthly budget impact (e.g. "$100/month for 3 months via Zip")
- "warnings": array of risk/caution strings (empty array if none)
- "timeframe": when they can realistically get this item (e.g. "Immediately", "2-3 months saving")

Return ONLY valid JSON, no markdown.`;

  const response = await ai.models.generateContent({
    model: MODEL_MAP.advise,
    contents: prompt,
  });

  const text = response.text || "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

export interface WishlistPrioritisation {
  rankings: {
    itemId: number;
    itemName: string;
    suggestedPriority: number;
    reasoning: string;
    suggestedAction: "buy_now" | "save_for" | "wait" | "skip";
  }[];
  overallAdvice: string;
}

export async function prioritiseWishlist(context: {
  items: { id: number; name: string; price: number; priority: number; category: string | null; notes: string | null; status: string }[];
  financialSnapshot: object;
  savingsGoals: object[];
  bnplExposure: number;
}): Promise<WishlistPrioritisation> {
  const prompt = `You are a friendly Australian financial advisor helping someone prioritise their wishlist.

They have these items on their wishlist:
${context.items.map((i, idx) => `${idx + 1}. "${i.name}" - $${(i.price / 100).toFixed(2)} (priority: ${i.priority}/5, category: ${i.category || "uncategorised"}, notes: ${i.notes || "none"}, status: ${i.status})`).join("\n")}

Their financial snapshot:
${JSON.stringify(context.financialSnapshot, null, 2)}

Their savings goals:
${JSON.stringify(context.savingsGoals, null, 2)}

Total BNPL exposure: $${(context.bnplExposure / 100).toFixed(2)}

Based on their financial health, suggest the best order to acquire these items. For each item, recommend:
- suggestedPriority (1-5, 1 = get first)
- suggestedAction: "buy_now" (can afford it now), "save_for" (start saving), "wait" (defer for now), "skip" (not worth it financially)
- reasoning (1-2 sentences, casual Australian tone)

Return JSON with:
- "rankings": array of { "itemId": number, "itemName": string, "suggestedPriority": number, "reasoning": string, "suggestedAction": string }
- "overallAdvice": a short paragraph of general advice about their wishlist spending

Return ONLY valid JSON, no markdown.`;

  const response = await ai.models.generateContent({
    model: MODEL_MAP.prioritise,
    contents: prompt,
  });

  const text = response.text || "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}
