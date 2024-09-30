import { inspect } from "node:util";

export function trim0xPrefix(address: string) {
  if (address.startsWith("0x")) {
    return address.slice(2);
  }
  return address;
}

export function print(data: any) {
  console.log(
    inspect(data, {
      showHidden: false,
      depth: null,
      colors: true,
      maxStringLength: 128,
    }),
  );
}
