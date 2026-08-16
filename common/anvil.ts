import { gunzipSync, gzipSync } from "node:zlib";
import type { Hex } from "viem";

interface IAccountState {
  balance: string;
  nonce: number;
  code: Hex;
  storage: { [slot: string]: Hex };
}

export interface IAnvilState {
  best_block_number: string;
  accounts: { [address: string]: IAccountState };
}

export function loadAnvilState(data: string): IAnvilState {
  if (data.startsWith("0x")) {
    data = data.slice(2);
  }
  const unzip = gunzipSync(Buffer.from(data, "hex")).toString();
  return JSON.parse(unzip);
}

export function dumpAnvilState(raw: IAnvilState) {
  const zip = gzipSync(Buffer.from(JSON.stringify(raw))).toString("hex");
  return "0x" + zip;
}
