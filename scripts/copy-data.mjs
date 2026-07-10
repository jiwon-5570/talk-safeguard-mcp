import { copyFile, mkdir } from "node:fs/promises";

await mkdir(new URL("../dist/data/", import.meta.url), { recursive: true });

const productionDataFiles = [
  "investment-risk-keywords.json",
  "official-spam-urls.csv",
  "scam-keywords.json",
];

await Promise.all(productionDataFiles.map((fileName) => copyFile(
  new URL(`../src/data/${fileName}`, import.meta.url),
  new URL(`../dist/data/${fileName}`, import.meta.url),
)));
