import { Router } from "express";
import { createComment, listComments } from "../controllers/comments.js";
import { getLikes, likeNft, unlikeNft } from "../controllers/likes.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { commentLimiter } from "../middleware/rateLimit.js";
import { getAllListed, getFeatured } from "../controllers/gallery.js";
import { searchAll } from "../controllers/search.js";


const router = Router();

router.get("/listings", getAllListed);
router.get("/featured", getFeatured);
router.get("/search", searchAll);
router.get("/:nftId/comments", listComments);
router.post("/:nftId/comments", requireAuth, commentLimiter, createComment);

router.get("/:nftId/likes", optionalAuth, getLikes);
router.put("/:nftId/like", requireAuth, likeNft);
router.delete("/:nftId/like", requireAuth, unlikeNft);

export default router;