/**
 * Converts snake_case object keys to camelCase.
 * Works on single objects and arrays of objects.
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toCamel<T = any>(obj: any): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => toCamel(item)) as T;
  }
  if (obj !== null && typeof obj === "object" && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[snakeToCamel(key)] = toCamel(value);
    }
    return result as T;
  }
  return obj;
}
