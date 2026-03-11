import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiter
// For production, consider using Redis (e.g., @upstash/ratelimit)

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_LIMIT: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
};

const AI_ROUTE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
};

// Routes that use AI/Gemini - stricter limits
const AI_ROUTES = [
  "/api/chat",
  "/api/categorise",
  "/api/purchase-advisor",
  "/api/affordability-check",
  "/api/wishlist/prioritise",
  "/api/wishlist/price-check",
  "/api/bnpl-plans/parse-screenshot",
  "/api/statements/parse-pdf",
];

function getClientId(request: NextRequest): string {
  // Use IP address + user agent hash for anonymous users
  // In production with auth, use user ID instead
  const ip = request.headers.get("x-forwarded-for") ||
             request.headers.get("x-real-ip") ||
             "unknown";
  const userAgent = request.headers.get("user-agent") || "";
  return `${ip}:${userAgent.slice(0, 50)}`;
}

function isAIRoute(pathname: string): boolean {
  return AI_ROUTES.some(route => pathname.startsWith(route));
}

export function rateLimit(
  request: NextRequest,
  config?: RateLimitConfig
): { success: boolean; limit: number; remaining: number; reset: number } {
  const clientId = getClientId(request);
  const pathname = request.nextUrl.pathname;
  
  // Use stricter limits for AI routes
  const limitConfig = config || (isAIRoute(pathname) ? AI_ROUTE_LIMIT : DEFAULT_LIMIT);
  
  const now = Date.now();
  const windowStart = now - limitConfig.windowMs;
  
  const key = `${clientId}:${pathname}`;
  const entry = rateLimitMap.get(key);
  
  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    cleanupExpiredEntries(windowStart);
  }
  
  if (!entry || entry.resetTime < now) {
    // First request or window expired
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + limitConfig.windowMs,
    };
    rateLimitMap.set(key, newEntry);
    
    return {
      success: true,
      limit: limitConfig.maxRequests,
      remaining: limitConfig.maxRequests - 1,
      reset: newEntry.resetTime,
    };
  }
  
  // Increment count
  entry.count++;
  
  const remaining = Math.max(0, limitConfig.maxRequests - entry.count);
  const success = entry.count <= limitConfig.maxRequests;
  
  return {
    success,
    limit: limitConfig.maxRequests,
    remaining,
    reset: entry.resetTime,
  };
}

function cleanupExpiredEntries(before: number): void {
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetTime < before) {
      rateLimitMap.delete(key);
    }
  }
}

// Middleware-compatible rate limit check
export function checkRateLimit(request: NextRequest): NextResponse | null {
  const result = rateLimit(request);
  
  if (!result.success) {
    return NextResponse.json(
      { 
        error: "Too many requests",
        retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
      },
      { 
        status: 429,
        headers: {
          "X-RateLimit-Limit": result.limit.toString(),
          "X-RateLimit-Remaining": result.remaining.toString(),
          "X-RateLimit-Reset": result.reset.toString(),
          "Retry-After": Math.ceil((result.reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }
  
  return null;
}

// Higher-order function to wrap route handlers with rate limiting
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  config?: RateLimitConfig
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const result = rateLimit(request, config);
    
    if (!result.success) {
      return NextResponse.json(
        { 
          error: "Too many requests",
          retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
        },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Limit": result.limit.toString(),
            "X-RateLimit-Remaining": result.remaining.toString(),
            "X-RateLimit-Reset": result.reset.toString(),
            "Retry-After": Math.ceil((result.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }
    
    const response = await handler(request);
    
    // Add rate limit headers to successful responses
    response.headers.set("X-RateLimit-Limit", result.limit.toString());
    response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    response.headers.set("X-RateLimit-Reset", result.reset.toString());
    
    return response;
  };
}
