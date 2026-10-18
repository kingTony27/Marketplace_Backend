import { Router } from "express";
import { getNonce, logout, verifySignIn } from "../controllers/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.use(authLimiter);
router.get("/nonce", getNonce);
router.post("/verify", verifySignIn);
router.post("/logout", logout);

export default router;