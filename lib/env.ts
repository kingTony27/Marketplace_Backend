import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const siweChainId = Number(required("SIWE_CHAIN_ID"));
if (!Number.isInteger(siweChainId)) throw new Error("SIWE_CHAIN_ID must be a number");

export const env = {
  jwtSecret: required("JWT_SECRET"),
  siweDomain: Number(required("SIWE_DOMAIN")),
  siweChainId,
  cookieSameSite: (process.env.COOKIE_SAMESITE ?? "lax") as "lax" | "strict" | "none",
  isProd: process.env.NODE_ENV === "production",
};