import { Router } from "express";
import { getMe, getUser, updateMe } from "../controllers/users.js";
import { getGallery, getListed  } from "../controllers/gallery.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// "/me" must come BEFORE "/:address", or "me" is read as an address
router.get("/me", requireAuth, getMe);
router.put("/me", requireAuth, updateMe);
router.get("/:address", getUser);
router.get("/:address/gallery", getGallery);
router.get("/:address/listed", getListed);

export default router;