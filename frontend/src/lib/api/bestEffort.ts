export async function bestEffort(label: string, action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (error) {
    console.warn(label, error);
  }
}
