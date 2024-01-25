export function cloneObject(obj: object): object {
  for (const prop of Object.getOwnPropertySymbols(obj)) {
    const desc = prop.description;
    if (desc == 'twurpleRawData') {
      return obj[prop];
    }
  }

  return {};
}
