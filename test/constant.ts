import { createHash } from "node:crypto";

export const PredployedAddress = {
  goatDao: "0xBC10000000000000000000000000000000000Da0",
  wgbtc: "0xbC10000000000000000000000000000000000000",
  goatToken: "0xbC10000000000000000000000000000000000001",
  goatFoundation: "0xBc10000000000000000000000000000000000002",
  bridge: "0xBC10000000000000000000000000000000000003",
  locking: "0xbC10000000000000000000000000000000000004",
  btcBlock: "0xbc10000000000000000000000000000000000005",
  relayer: "0xBC10000000000000000000000000000000000006",
};

export const Executors = {
  relayer: "0xBc10000000000000000000000000000000001000",
  locking: "0xBC10000000000000000000000000000000001001",
};

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
