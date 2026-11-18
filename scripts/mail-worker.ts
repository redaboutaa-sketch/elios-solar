import "dotenv/config";
import { processOutbox } from "../src/server/mail/transport";

const once = process.argv.includes("--once");
async function loop() {
  const r = await processOutbox();
  if (r.pending > 0) console.log(`[mail-worker] envoyés=${r.sent} échecs=${r.failed}`);
  if (!once) setTimeout(loop, 5000);
  else process.exit(0);
}
loop();
