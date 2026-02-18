import { db } from "@/lib/db";
import { wishlistItems } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import FirecrawlApp from "@mendable/firecrawl-js";
import { GoogleGenAI } from "@google/genai";

let _firecrawl: FirecrawlApp | null = null;
function getFirecrawl(): FirecrawlApp {
  if (!_firecrawl) {
    _firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY || "" });
  }
  return _firecrawl;
}

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  }
  return _ai;
}

interface PriceCheckResult {
  itemId: number;
  itemName: string;
  originalPrice: number; // cents AUD
  currentPrice: number | null; // cents AUD (converted)
  foreignPrice: number | null; // price in original currency (dollars, not cents)
  foreignCurrency: string | null; // e.g. "GBP", "USD", "EUR", null if AUD
  onSale: boolean;
  saleLabel: string | null;
  priceDifference: number; // cents (negative = cheaper)
  percentChange: number;
  url: string;
  lastChecked: string;
  error: string | null;
}

export async function POST() {
  try {
    // Fetch all active wishlist items that have URLs
    const items = await db
      .select()
      .from(wishlistItems)
      .orderBy(wishlistItems.priority);

    const itemsWithUrls = items.filter(
      (item) =>
        item.url &&
        (item.status === "wanted" || item.status === "saving")
    );

    if (itemsWithUrls.length === 0) {
      return NextResponse.json(
        { error: "No active wishlist items have URLs to check" },
        { status: 400 }
      );
    }

    // Scrape each URL with Firecrawl and extract price data
    const results: PriceCheckResult[] = [];

    // Process items concurrently (max 3 at a time to be respectful)
    const chunks = [];
    for (let i = 0; i < itemsWithUrls.length; i += 3) {
      chunks.push(itemsWithUrls.slice(i, i + 3));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(async (item) => {
          try {
            // Scrape the product page with Firecrawl
            const scrapeResult = await getFirecrawl().scrape(item.url!, {
              formats: ["markdown"],
              onlyMainContent: true,
            });

            if (!scrapeResult.markdown) {
              return {
                itemId: item.id,
                itemName: item.name,
                originalPrice: item.price,
                currentPrice: null,
                foreignPrice: null,
                foreignCurrency: null,
                onSale: false,
                saleLabel: null,
                priceDifference: 0,
                percentChange: 0,
                url: item.url!,
                lastChecked: new Date().toISOString(),
                error: "Could not scrape product page",
              } as PriceCheckResult;
            }

            // Use Gemini to extract price information from the scraped content
            const priceData = await extractPriceWithAI(
              scrapeResult.markdown,
              item.name,
              item.price
            );

            const currency = priceData.currency || "AUD";
            const isAud = currency.toUpperCase() === "AUD";

            // Convert to AUD cents for comparison
            const audCents = priceData.currentPrice
              ? await convertToAudCents(priceData.currentPrice, currency)
              : null;
            const priceDiff = audCents ? audCents - item.price : 0;
            const percentChange = audCents
              ? ((audCents - item.price) / item.price) * 100
              : 0;

            return {
              itemId: item.id,
              itemName: item.name,
              originalPrice: item.price,
              currentPrice: audCents,
              foreignPrice: !isAud ? priceData.currentPrice : null,
              foreignCurrency: !isAud ? currency : null,
              onSale: priceData.onSale,
              saleLabel: priceData.saleLabel,
              priceDifference: priceDiff,
              percentChange: Math.round(percentChange * 10) / 10,
              url: item.url!,
              lastChecked: new Date().toISOString(),
              error: null,
            } as PriceCheckResult;
          } catch (err) {
            return {
              itemId: item.id,
              itemName: item.name,
              originalPrice: item.price,
              currentPrice: null,
              foreignPrice: null,
              foreignCurrency: null,
              onSale: false,
              saleLabel: null,
              priceDifference: 0,
              percentChange: 0,
              url: item.url!,
              lastChecked: new Date().toISOString(),
              error:
                err instanceof Error
                  ? err.message
                  : "Failed to check price",
            } as PriceCheckResult;
          }
        })
      );

      for (const result of chunkResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        }
      }
    }

    // Separate into categories
    const priceDrops = results.filter(
      (r) => r.currentPrice !== null && r.priceDifference < 0
    );
    const priceIncreases = results.filter(
      (r) => r.currentPrice !== null && r.priceDifference > 0
    );
    const onSale = results.filter((r) => r.onSale);
    const unchanged = results.filter(
      (r) => r.currentPrice !== null && r.priceDifference === 0
    );
    const errors = results.filter((r) => r.error !== null);

    return NextResponse.json({
      results,
      summary: {
        totalChecked: results.length,
        priceDrops: priceDrops.length,
        priceIncreases: priceIncreases.length,
        onSale: onSale.length,
        unchanged: unchanged.length,
        errors: errors.length,
        totalSavings: priceDrops.reduce(
          (sum, r) => sum + Math.abs(r.priceDifference),
          0
        ),
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Price check error:", err);
    return NextResponse.json(
      { error: "Failed to check prices" },
      { status: 500 }
    );
  }
}

// Live exchange rates from Frankfurter API (ECB data, free, no key)
// Returns rates with AUD as base — e.g. { USD: 0.64, GBP: 0.51 }
// meaning 1 AUD = 0.64 USD, so to convert 399 GBP → AUD: 399 / 0.51
let cachedRates: Record<string, number> | null = null;
let ratesFetchedAt = 0;
const RATES_TTL = 1000 * 60 * 60; // cache for 1 hour

async function fetchLiveRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cachedRates && now - ratesFetchedAt < RATES_TTL) {
    return cachedRates;
  }

  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=AUD");
    if (!res.ok) throw new Error(`Frankfurter API ${res.status}`);
    const data = await res.json();
    cachedRates = data.rates as Record<string, number>;
    ratesFetchedAt = now;
    return cachedRates;
  } catch (err) {
    console.error("Failed to fetch live exchange rates, using fallback:", err);
    // Fallback approximate rates if API is down
    return {
      USD: 0.64, GBP: 0.51, EUR: 0.60, NZD: 0.92,
      CAD: 0.91, JPY: 96.0, SGD: 0.85, HKD: 4.99, CNY: 4.63,
    };
  }
}

interface PriceExtractionResult {
  currentPrice: number | null; // in the page's currency
  currency: string; // ISO code e.g. "GBP", "USD", "AUD"
  onSale: boolean;
  saleLabel: string | null;
}

async function extractPriceWithAI(
  pageContent: string,
  itemName: string,
  originalPriceCents: number
): Promise<PriceExtractionResult> {
  // Truncate content to avoid token limits
  const truncated = pageContent.slice(0, 8000);
  const originalPrice = (originalPriceCents / 100).toFixed(2);

  const prompt = `You are a price extraction expert. Analyse this product page content and extract pricing information.

Product we're looking for: "${itemName}"
Our saved price (in AUD): A$${originalPrice}

Page content:
${truncated}

Extract the following and return as JSON:
- "currentPrice": the current selling price as a number in the ORIGINAL currency shown on the page (e.g. 399.00). If there's a sale price and original price, use the SALE price. If you can't find a price, use null.
- "currency": the ISO 4217 currency code of the price on the page. Detect from symbols and context:
  - £ or "GBP" → "GBP"
  - $ with .com (US site), "USD" → "USD"
  - $ with .com.au (Australian site), "AUD", "A$" → "AUD"
  - € or "EUR" → "EUR"
  - NZ$ or .co.nz → "NZD"
  - If unclear, check the site's domain/country. Default to "AUD" only if the site is clearly Australian.
- "onSale": boolean, true if the product appears to be on sale, discounted, or has a promotional price
- "saleLabel": if on sale, what's the sale description (e.g. "30% off", "Summer Sale", "Was £449 Now £399"). null if not on sale.

CRITICAL: Do NOT assume prices are in AUD. Detect the actual currency from the page. Look for £, €, $ symbols, domain TLD (.co.uk, .com, .com.au), and any currency labels.

Return ONLY valid JSON, no markdown formatting.`;

  const response = await getAI().models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = response.text || "";
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return { currentPrice: null, currency: "AUD", onSale: false, saleLabel: null };
  }
}

async function convertToAudCents(price: number, currency: string): Promise<number> {
  if (currency.toUpperCase() === "AUD") return Math.round(price * 100);
  const rates = await fetchLiveRates();
  const rate = rates[currency.toUpperCase()];
  if (!rate) return Math.round(price * 100); // unknown currency, assume AUD
  // rate = how much of `currency` 1 AUD buys, so AUD = price / rate
  return Math.round((price / rate) * 100);
}
