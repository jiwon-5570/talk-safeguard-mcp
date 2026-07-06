import { readFileSync } from "node:fs";

export function loadJsonData<T>(fileName: string): T {
  const path = new URL(`../data/${fileName}`, import.meta.url);
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
