import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client'; // Assuming Prisma generated types

// Extend the Request type to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: UserRole; // Assuming Prisma enum maps directly
      };
    }
  }
}

export const checkRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'Unauthorized: No role information found' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Forbidden: Requires one of roles: ${roles.join(', ')}` });
    }

    next();
  };
};
