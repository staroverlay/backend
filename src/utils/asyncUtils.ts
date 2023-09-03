export async function asyncMap<I, O>(
  arr: I[],
  fn: (i: I) => Promise<O>,
): Promise<O[]> {
  const mapped = [];
  for (const item of arr) {
    const value = await fn(item);
    mapped.push(value);
  }
  return mapped;
}
