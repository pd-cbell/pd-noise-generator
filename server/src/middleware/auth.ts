import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { serverConfig } from '../config';
import prisma from '../prisma';
import { UserRole } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
  };
}

export const authenticateUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, serverConfig.jwtSecret) as { userId: string; email: string };
    
    // Fetch user to get current role
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    
    if (!user) {
        return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
        userId: user.id,
        email: user.email,
        role: user.role
    };
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
