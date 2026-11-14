/** Small className utility without additional runtime dependencies. */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, unknown>;

export function cn(...values: ClassValue[]): string {
  const classes: string[] = [];
  const visit = (value: ClassValue): void => {
    if (!value) return;
    if (typeof value === "string" || typeof value === "number") {
      classes.push(String(value));
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else {
      Object.entries(value).forEach(([key, enabled]) => {
        if (enabled) classes.push(key);
      });
    }
  };
  values.forEach(visit);
  return classes.join(" ");
}
