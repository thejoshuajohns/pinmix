import { cpSync } from "node:fs";

cpSync("static", "dist", { recursive: true });
