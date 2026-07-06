import { cp, mkdir } from "node:fs/promises";

await mkdir(new URL("../dist/data/", import.meta.url), { recursive: true });
await cp(
  new URL("../src/data/", import.meta.url),
  new URL("../dist/data/", import.meta.url),
  { recursive: true },
);
