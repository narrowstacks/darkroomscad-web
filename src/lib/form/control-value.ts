export function coerceOptionValue(
  options: { value: string | number; label: string }[] | undefined,
  raw: string,
): string | number {
  const opt = options?.find((o) => String(o.value) === raw);
  return opt ? opt.value : raw;
}

export function clampSlider(value: number, min?: number, max?: number): number {
  let v = value;
  if (min !== undefined && v < min) v = min;
  if (max !== undefined && v > max) v = max;
  return v;
}
