// Trigger shared codegen (emit:openapi) then run local orval to generate
// src/api/endpoints/{endpoints.ts,endpoints.schemas.ts} from the OpenAPI.yaml.
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sharedDir = resolve(root, "../lab-management-system-shared");

console.log("[gen-shared] step 1/2 — shared: emit OpenAPI.yaml...");
execSync("npm run emit:openapi", { cwd: sharedDir, stdio: "inherit" });

console.log("[gen-shared] step 2/2 — nextjs: orval → src/api/endpoints/...");
execSync("npx orval", { cwd: root, stdio: "inherit" });

console.log("[gen-shared] OK");
