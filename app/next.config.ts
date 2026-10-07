import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// Reuse the beCPG connection settings of the repository root.
for (const file of ["../.env", "../.env.example"]) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

const nextConfig: NextConfig = {};

export default nextConfig;
