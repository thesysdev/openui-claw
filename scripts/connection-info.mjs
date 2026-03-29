import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const p = join(homedir(), ".openclaw", "openclaw.json");
const c = JSON.parse(readFileSync(p, "utf8"));
const host = c.gateway?.bind?.host || "127.0.0.1";
const port = c.gateway?.bind?.port || 18789;
const token = c.gateway?.auth?.token;
console.log("Gateway:", `ws://${host}:${port}`);
console.log("Token:", token || "<not set>");
