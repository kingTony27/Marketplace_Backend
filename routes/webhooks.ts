
import express, { Router } from "express";
import { alchemyWebhook } from "../controllers/webhooks.js";

const WebhooksRouter = Router();

// express.raw keeps the body as untouched bytes, which the signature check needs
WebhooksRouter.post("/api/webhooks/alchemy", express.raw({ type: "application/json", limit: "1mb" }), alchemyWebhook);

export default WebhooksRouter;

