/** Reads a single route query value while ignoring repeated query params. */
export const firstRouteQueryValue = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    const firstValue = value[0];

    return typeof firstValue === "string" ? firstValue : undefined;
  }

  return typeof value === "string" ? value : undefined;
};

/** Parses a numeric route query value into safe bounds, falling back when links are hand-edited. */
export const boundedNumberRouteQueryValue = (value: unknown, fallback: number, min: number, max: number): number => {
  const rawValue = firstRouteQueryValue(value);
  const parsedValue = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN;

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(Math.max(parsedValue, min), max);
};
