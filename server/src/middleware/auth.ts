import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { serverConfig } from '../config';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export const authenticateUser = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, serverConfig.jwtSecret) as { userId: string; email: string };
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
