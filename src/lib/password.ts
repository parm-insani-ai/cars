import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, ROUNDS);
}

export async function verifyPassword(plaintext: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plaintext, hash);
}
