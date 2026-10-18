import { Router } from "express";
import { deleteComment } from "../controllers/comments.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.delete("/:commentId", requireAuth, deleteComment);

export default router;                                          