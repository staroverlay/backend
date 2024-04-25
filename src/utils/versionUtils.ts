export function isSemVerHigh(oldVersion: string, newVersion: string): boolean {
  const [major1, minor1, patch1] = newVersion.split('.').map(Number);
  const [major2, minor2, patch2] = oldVersion.split('.').map(Number);

  if (major1 > major2) {
    return true;
  }

  if (major1 === major2) {
    if (minor1 > minor2) {
      return true;
    }

    if (minor1 === minor2) {
      if (patch1 > patch2) {
        return true;
      }
    }
  }

  return false;
}
