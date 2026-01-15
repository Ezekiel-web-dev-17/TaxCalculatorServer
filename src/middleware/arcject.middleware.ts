import type { ArcjetNodeRequest } from "@arcjet/node";
import aj from "../config/arcjet.config.js";
import type { NextFunction, Request, Response } from "express";
import { isSpoofedBot } from "@arcjet/inspect";

export const arcjetMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const decision = await aj.protect(req as ArcjetNodeRequest, { requested: 5 }); // Deduct 5 tokens from the bucket

  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return res.status(429).json({ error: "Too many requests" });
    } else if (decision.reason.isBot()) {
      return res.status(403).json({ error: "No bots allowed" });
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }
  } else if (decision.ip.isHosting()) {
    // Requests from hosting IPs are likely from bots, so they can usually be
    // blocked. However, consider your use case - if this is an API endpoint
    // then hosting IPs might be legitimate.
    // https://docs.arcjet.com/blueprints/vpn-proxy-detection
    return res.status(403).json({ error: "Forbidden" });
  } else if (decision.results.some(isSpoofedBot)) {
    // Paid Arcjet accounts include additional verification checks using IP data.
    // Verification isn't always possible, so we recommend checking the decision
    // separately.
    // https://docs.arcjet.com/bot-protection/reference#bot-verification
    return res.status(403).json({ error: "Forbidden" });
  } else next();
};