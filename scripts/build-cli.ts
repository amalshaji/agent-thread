import { $ } from "bun";

await $`mkdir -p dist`;
await $`bun build src/cli/index.ts --target=bun --outfile=dist/cli.js`;

const content = await Bun.file("dist/cli.js").text();
await Bun.write("dist/cli.js", `#!/usr/bin/env bun\n${content}`);
await $`chmod +x dist/cli.js`;

console.log("Built dist/cli.js");
