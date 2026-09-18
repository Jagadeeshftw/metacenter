import fs from "node:fs";
import path from "node:path";

// The owner drops logo.svg / logo.png into public/. Until then the text wordmark is used.
const pub = (f: string) => fs.existsSync(path.join(process.cwd(), "public", f));
export const brandAssets = () => ({ svg: pub("logo.svg"), png: pub("logo.png") });
