import { Request, Response, NextFunction } from 'express';

export const requireAgentEnabled = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.agentEnabled) {
    return res.status(403).json({ message: 'Agent access is disabled for this user' });
  }
  next();
};
