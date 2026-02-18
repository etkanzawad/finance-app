import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { like } from "drizzle-orm";
import { categoriseTransactions } from "@/lib/gemini";

interface ParsedTransaction {
  date: string;
  rawDescription: string;
  amount: number; // cents, negative for debits
  balanceAfter?: number;
  accountId: number;
  statementMonth: string;
}

// Strip NAB noise from descriptions
function cleanNabDescription(raw: string): string {
  let desc = raw.trim();
  // Strip VISA DEBIT PURCHASE CARD XXXX prefix
  desc = desc.replace(
    /^(VISA\s+DEBIT\s+PURCHASE\s+)?CARD\s+\d{4}\s*/i,
    ""
  );
  // Strip EFTPOS/VISA prefix
  desc = desc.replace(/^(EFTPOS|VISA|MASTERCARD|DEBIT CARD)\s+/i, "");
  // Strip BSB/account numbers
  desc = desc.replace(/\bBSB\s*\d{3}-?\d{3}\b/gi, "");
  desc = desc.replace(/\bACC?\s*\d{4,}\b/gi, "");
  // Strip reference numbers (e.g., "Ref: 123456")
  desc = desc.replace(/\bRef:?\s*\d+/gi, "");
  // Strip trailing card number patterns
  desc = desc.replace(/\b\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\b/g, "");
  desc = desc.replace(/\bx{4,}\d{4}\b/gi, "");
  // Strip date suffixes like "01/02"
  desc = desc.replace(/\s+\d{2}\/\d{2}\s*$/, "");
  // Strip trailing value date
  desc = desc.replace(/\s+Value Date:\s*\d{2}\/\d{2}\/\d{4}/gi, "");
  // Strip "PENDING" prefix
  desc = desc.replace(/^PENDING\s+/i, "");
  // Strip "DIRECT DEBIT" prefix
  desc = desc.replace(/^DIRECT\s+DEBIT\s*/i, "");
  // Strip international transaction markers
  desc = desc.replace(/\b[A-Z]{2}\s+AUD\s+\d+\.\d{2}\b/g, "");
  desc = desc.replace(/\bFOREIGN\s+CURRENCY\s+CONVERSION\s+FEE\b/gi, "");
  // Collapse whitespace
  desc = desc.replace(/\s+/g, " ").trim();
  return desc || raw.trim();
}

function detectIncome(raw: string, amount: number): boolean {
  if (amount > 0) {
    const incomePatterns =
      /\b(SALARY|WAGES|PAY|PAYROLL|XFER|TRANSFER\s+FROM|INTEREST|REFUND|CASHBACK|REBATE|DIVIDEND)\b/i;
    return incomePatterns.test(raw);
  }
  return false;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { transactions: parsedTxns, accountId } = body as {
    transactions: ParsedTransaction[];
    accountId: number;
  };

  if (!parsedTxns || !Array.isArray(parsedTxns) || parsedTxns.length === 0) {
    return NextResponse.json(
      { error: "transactions array required" },
      { status: 400 }
    );
  }

  if (!accountId) {
    return NextResponse.json(
      { error: "accountId required" },
      { status: 400 }
    );
  }

  // Step 1: Clean descriptions and check merchant_mappings
  const allMappings = await db.select().from(schema.merchantMappings);

  const needsCategorisation: { index: number; cleaned: string }[] = [];
  const results: {
    index: number;
    cleanName: string;
    category: string;
    isIncome: boolean;
  }[] = [];

  for (let i = 0; i < parsedTxns.length; i++) {
    const tx = parsedTxns[i];
    const cleaned = cleanNabDescription(tx.rawDescription);
    const isIncome = detectIncome(tx.rawDescription, tx.amount);

    // Check merchant_mappings for a match
    const mapping = allMappings.find((m) => {
      const pattern = m.rawPattern.toLowerCase();
      return cleaned.toLowerCase().includes(pattern);
    });

    if (mapping) {
      results.push({
        index: i,
        cleanName: mapping.cleanName,
        category: mapping.category,
        isIncome,
      });
    } else if (isIncome) {
      results.push({
        index: i,
        cleanName: cleaned,
        category: "Income",
        isIncome: true,
      });
    } else {
      needsCategorisation.push({ index: i, cleaned });
    }
  }

  // Step 2: Batch categorise uncategorised via Gemini
  const BATCH_SIZE = 40;
  for (let b = 0; b < needsCategorisation.length; b += BATCH_SIZE) {
    const batch = needsCategorisation.slice(b, b + BATCH_SIZE);
    try {
      const aiResults = await categoriseTransactions(
        batch.map((item) => item.cleaned)
      );
      for (let j = 0; j < batch.length; j++) {
        const aiResult = aiResults[j];
        if (aiResult) {
          results.push({
            index: batch[j].index,
            cleanName: aiResult.cleanName,
            category: aiResult.category,
            isIncome: false,
          });
        } else {
          results.push({
            index: batch[j].index,
            cleanName: batch[j].cleaned,
            category: "Other",
            isIncome: false,
          });
        }
      }
    } catch {
      // If AI fails, mark as Other
      for (const item of batch) {
        results.push({
          index: item.index,
          cleanName: item.cleaned,
          category: "Other",
          isIncome: false,
        });
      }
    }
  }

  // Step 3: Build transaction records for review (not yet saved)
  const reviewTransactions = parsedTxns.map((tx, i) => {
    const result = results.find((r) => r.index === i);
    return {
      accountId,
      date: tx.date,
      rawDescription: tx.rawDescription,
      cleanDescription: result?.cleanName || cleanNabDescription(tx.rawDescription),
      amount: tx.amount,
      balanceAfter: tx.balanceAfter ?? null,
      category: result?.category || "Other",
      isIncome: result?.isIncome || false,
      isReviewed: false,
      statementMonth: tx.statementMonth,
    };
  });

  // Check for duplicates
  const existingTxns = await db
    .select()
    .from(schema.transactions)
    .where(
      like(
        schema.transactions.statementMonth,
        reviewTransactions[0]?.statementMonth || "%"
      )
    );

  const duplicates: number[] = [];
  for (let i = 0; i < reviewTransactions.length; i++) {
    const tx = reviewTransactions[i];
    const isDuplicate = existingTxns.some(
      (existing) =>
        existing.date === tx.date &&
        existing.rawDescription === tx.rawDescription &&
        existing.amount === tx.amount
    );
    if (isDuplicate) {
      duplicates.push(i);
    }
  }

  return NextResponse.json({
    transactions: reviewTransactions,
    duplicates,
    total: reviewTransactions.length,
    categorised: results.filter((r) => r.category !== "Other").length,
    fromMappings: results.length - needsCategorisation.length,
    fromAI: needsCategorisation.length,
  });
}
