import { $ } from "bun";

await $`mkdir -p dist`;
await $`bun build src/cli/index.ts --target=bun --outfile=dist/cli.js`;

// Bun build preserves the shebang from the entry point; add one only if absent.
const content = await Bun.file("dist/cli.js").text();
if (!content.startsWith("#!")) {
  await Bun.write("dist/cli.js", `#!/usr/bin/env bun\n${content}`);
}
await $`chmod +x dist/cli.js`;

console.log("Built dist/cli.js");
