import { Request, Response } from "express";
import { sessionService } from "../services/sessionService";

class SessionController {
  async listUserSessions(req: Request, res: Response) {
    try {
      const userId = req.params.id;
      const sessions = await sessionService.findActiveSessionsByUser(userId);
      return res.json({ sessions });
    } catch (err) {
      console.error("Failed to list sessions:", err);
      return res.status(500).json({ message: "Failed to list sessions" });
    }
  }

  async killSession(req: Request, res: Response) {
    try {
      const sessionId = req.params.sessionId;
      const updated = await sessionService.killSessionById(sessionId);
      return res.json({ message: "Session killed", session: updated });
    } catch (err) {
      console.error("Failed to kill session:", err);
      return res.status(500).json({ message: "Failed to kill session" });
    }
  }
}

export const sessionController = new SessionController();
