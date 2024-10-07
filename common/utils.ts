import { createHash } from "node:crypto";
import { inspect } from "node:util";
import fs from "fs/promises";

export const trimPubKeyPrefix = (key: string) => {
  if (key.startsWith("0x")) {
    key = key.slice(2);
  }
  if (key.length === 130 && key.startsWith("04")) {
    key = key.slice(2);
  }
  return Buffer.from(key, "hex");
};

export const hash160 = (data: Buffer) => {
  const sum256 = createHash("sha256").update(data).digest();
  return "0x" + createHash("ripemd160").update(sum256).digest("hex");
};

export const sha256 = (data: Buffer) => {
  return createHash("sha256").update(data).digest("hex")
};

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

export async function readJson<T>(path: string): Promise<T> {
  const paramFile = await fs.readFile(path, "utf-8");
  return JSON.parse(paramFile.toString())
}
