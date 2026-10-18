import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Reads a generated API example (contracts/examples/*.json): `{ status, body }`. */
export function example<T>(name: string): { status: number; body: T } {
  const file = resolve(import.meta.dirname, '../../../contracts/examples', `${name}.json`);
  return JSON.parse(readFileSync(file, 'utf8')) as { status: number; body: T };
}
