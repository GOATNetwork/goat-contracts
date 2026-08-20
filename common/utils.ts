import fs from "fs/promises";
import { createHash, ECDH } from "node:crypto";
import { inspect } from "node:util";
import {
  bytesToHex,
  getAddress,
  isHex,
  parseSignature,
  type Address,
  type Hex,
} from "viem";

export const trimPubKeyPrefix = (key: string) => {
  if (key.startsWith("0x")) {
    key = key.slice(2);
  }
  if (key.length === 130 && key.startsWith("04")) {
    key = key.slice(2);
  }
  return Buffer.from(key, "hex");
};

export const hash160 = (data: Buffer): Hex => {
  const sum256 = createHash("sha256").update(data).digest();
  return bytesToHex(createHash("ripemd160").update(sum256).digest());
};

export const sha256 = (data: Buffer): Hex => {
  return bytesToHex(createHash("sha256").update(data).digest());
};

export function trim0xPrefix(address: string) {
  if (address.startsWith("0x")) {
    return address.slice(2);
  }
  return address;
}

export function print(data: unknown) {
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
  return JSON.parse(paramFile.toString()) as T;
}

export function parseValidatorPublicKey(publicKey: string): {
  coordinates: readonly [Hex, Hex];
  validatorAddress: Address;
} {
  const rawKey = trimPubKeyPrefix(publicKey);
  const encodedKey =
    rawKey.length === 64
      ? Buffer.concat([Buffer.from([0x04]), rawKey])
      : rawKey;
  const uncompressed = Buffer.from(
    ECDH.convertKey(
      encodedKey,
      "secp256k1",
      undefined,
      undefined,
      "uncompressed",
    ),
  ).subarray(1);
  if (uncompressed.length !== 64) {
    throw new Error("invalid secp256k1 public key");
  }
  const compressed = Buffer.concat([
    Buffer.from([uncompressed[63] % 2 === 0 ? 0x02 : 0x03]),
    uncompressed.subarray(0, 32),
  ]);
  return {
    coordinates: [
      bytesToHex(uncompressed.subarray(0, 32)),
      bytesToHex(uncompressed.subarray(32)),
    ],
    validatorAddress: getAddress(hash160(compressed)),
  };
}

export function parseValidatorSignature(signature: string): {
  r: Hex;
  s: Hex;
  v: number;
} {
  if (!isHex(signature)) {
    throw new Error("invalid validator signature");
  }
  const parsed = parseSignature(signature);
  const v = parsed.v ?? BigInt(parsed.yParity + 27);
  return { r: parsed.r, s: parsed.s, v: Number(v) };
}
