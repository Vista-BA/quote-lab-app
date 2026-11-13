// Usage: DATABASE_URL=postgres://... npm run load   (or open /api/setup?key=LAB_WRITE_KEY once after deploy)
import { loadAll } from "../lib/load.js";
console.log("done:", await loadAll());
