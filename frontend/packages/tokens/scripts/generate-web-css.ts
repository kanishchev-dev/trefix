import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { renderWebThemeCss } from "../src/web";

const target = fileURLToPath(
  new URL("../../ui/src/styles/theme.css", import.meta.url),
);
writeFileSync(target, renderWebThemeCss());
console.log(`Wrote ${target}`);
