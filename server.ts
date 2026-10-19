import express from "express";
import { httpServerHandler } from "cloudflare:node";
import "dotenv/config";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import WebhooksRouter from "./routes/webhooks.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import nftsRouter from "./routes/nfts.js";
import commentsRouter from "./routes/comments.js";
import notificationsRouter from "./routes/notifications.js"; 
import "dotenv/config";  


const app = express();

app.set("trust proxy", 1); // so rate limits see the real client IP behind your host's proxy

//alchemy routes 
app.use("/", WebhooksRouter); // Use the router for handling webhook routes

//middleware 
app.use(express.json()); //middleware to parse JSON bodies
app.use(cookieParser());

//api routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/nfts", nftsRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/notifications", notificationsRouter);



// Error handling middleware
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Something went wrong" });
});


// Start the server
app.listen(5000, () => {
    console.log("Server is running on port 5000");
});

export default httpServerHandler({ port: 5000 });