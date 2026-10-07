// The product assistant from the command line: the same agent as in the app, for scripts, scheduled
// jobs or your own agents.
//   npm run agent -- "Make a gluten-free version of FP-COOKIE and compare it with the original"
import { existsSync } from "node:fs";

for (const file of ["../.env", "../.env.example"]) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

const prompt = process.argv.slice(2).join(" ").trim();
if (!prompt) {
  console.error('Usage: npm run agent -- "your request"');
  process.exit(1);
}

// Imported after the environment is loaded: the beCPG client reads its settings on import.
const { runAgent } = await import("../lib/agent.ts");

try {
  await runAgent([], prompt, (event) => {
    if (event.type === "text") process.stdout.write(event.delta);
    if (event.type === "tool") process.stdout.write(`\n  → ${event.label}\n`);
    if (event.type === "error") console.error(`\n${event.message}`);
  });
  process.stdout.write("\n");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error("Set ANTHROPIC_API_KEY in the .env file at the root of the starter.");
  process.exit(1);
}
