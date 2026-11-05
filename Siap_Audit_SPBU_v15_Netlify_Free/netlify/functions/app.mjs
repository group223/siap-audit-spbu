import { getStore } from "@netlify/blobs";
import { createApp } from "../../server/app.mjs";

const handle = createApp({
  getStore: () => getStore("siap-audit-accounts-v15"),
  getAuditStore: () => getStore({ name: "siap-audit-data-v16", consistency: "strong" }),
});
export default handle;
export const config = {
  path: "/*",
  preferStatic: false,
  rateLimit: { windowLimit: 600, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
