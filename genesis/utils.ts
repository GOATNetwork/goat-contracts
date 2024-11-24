import { ethers } from "ethers";

export function toSatoshi(value: number) {
  value = value * 1e8;
  if (!Number.isInteger(value)) {
    throw new Error("invalid btc value");
  }
  return value.toString(10);
}

export function toWei(value: number) {
  return ethers.parseEther(value.toString(10)).toString(10);
}

export const BitcoinToken = "0x0000000000000000000000000000000000000000";

export function dayToHours(value: number) {
  if (!Number.isInteger(value)) {
    throw new Error("invalid day value");
  }
  return (value * 24).toString(10) + "h";
}
