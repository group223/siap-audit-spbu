import { getStore } from "@netlify/blobs";
import { createApp } from "../../server/app.mjs";

const handle = createApp({ getStore: () => getStore("siap-audit-accounts-v15") });
export default handle;
export const config = {
  path: "/*",
  preferStatic: false,
  rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
