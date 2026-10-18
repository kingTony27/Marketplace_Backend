import { Router } from "express";
import { requireAuth } from "../middleware/auth.js"; // your existing auth middleware
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../controllers/notifications.js";

const router = Router();

router.use(requireAuth);

router.get("/", getNotifications);
router.patch("/read-all", markAllAsRead); // must come before "/:id"
router.patch("/:id", markAsRead);
router.delete("/:id", deleteNotification);

export default router;