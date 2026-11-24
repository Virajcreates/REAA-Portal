import { Hono } from "hono";
import { adminRoutes } from "./routes/admin";
import { gatewayRoutes } from "./routes/gateway";
import { portalRoutes } from "./routes/portal";
import type { AppVariables, Env } from "./types";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.route("/portal/admin", adminRoutes);
app.route("/portal", portalRoutes);
app.route("/gateway", gatewayRoutes);

app.all("*", async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.json({ error: "not_found", message: "Resource not found." }, 404);
});

app.onError((err, c) =>
  c.json({ error: "internal_error", message: err.message || "Unexpected server error." }, 500)
);

export default app;
