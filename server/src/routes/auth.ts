import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { encrypt, decrypt } from '../utils/crypto';
import { authenticateUser, AuthRequest } from '../middleware/auth';
import { serverConfig } from '../config';
import { Role } from '@prisma/client';

const router = Router();
const client = new OAuth2Client(serverConfig.googleClientId);

router.post('/google', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'Missing idToken' });

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: serverConfig.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error('Invalid token payload');

    const { sub: googleId, email, name, picture: avatarUrl } = payload;

    if (!email) throw new Error('Email not provided by Google');

    const existingUsers = await prisma.user.count();
    const isFirstUser = existingUsers === 0;

    const user = await prisma.user.upsert({
      where: { googleId },
      update: { name, avatarUrl, email },
      create: {
        googleId,
        email,
        name,
        avatarUrl,
        role: isFirstUser ? Role.ADMIN : undefined,
      },
    });

    const sessionToken = jwt.sign(
      { userId: user.id, email: user.email },
      serverConfig.jwtSecret, 
      { expiresIn: '7d' }
    );

    res.cookie('token', sessionToken, {
      httpOnly: true,
      secure: serverConfig.isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ user });
  } catch (error: any) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Authentication failed', details: error.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

router.get('/me', async (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const decoded = jwt.verify(token, serverConfig.jwtSecret) as { userId: string };
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) return res.status(401).json({ error: 'User not found' });

        const credentials = {
            apiToken: user.encryptedPagerDutyApiToken ? decrypt(user.encryptedPagerDutyApiToken) : null,
            globalRoutingKey: user.encryptedGlobalRoutingKey ? decrypt(user.encryptedGlobalRoutingKey) : null,
            fromEmail: user.encryptedFromEmail ? decrypt(user.encryptedFromEmail) : null,
        };

            res.json({ user, credentials });
          } catch (e) {
            res.status(401).json({ error: 'Invalid token' });
          }
        });
        
        // Update Credentials (Protected)
        router.put('/credentials', authenticateUser, async (req: any, res) => {
          const { userId } = (req as AuthRequest).user!;
          const { apiToken, globalRoutingKey, fromEmail } = req.body;
        
          try {
            await prisma.user.update({
              where: { id: userId },
              data: {
                encryptedPagerDutyApiToken: apiToken ? encrypt(apiToken) : undefined,
                encryptedGlobalRoutingKey: globalRoutingKey ? encrypt(globalRoutingKey) : undefined,
                encryptedFromEmail: fromEmail ? encrypt(fromEmail) : undefined,
              },
            });
            res.json({ message: 'Credentials updated' });
          } catch (error: any) {
            res.status(500).json({ error: 'Failed to update credentials', details: error.message });
          }
        });
        
        // DEV ONLY: Bypass Google Auth
        if (!serverConfig.isProduction) {
          router.post('/dev-login', async (req, res) => {
            try {
              const email = 'dev@localhost';
              const googleId = 'dev-dummy-id';
              
              const existingUsers = await prisma.user.count();
              const isFirstUser = existingUsers === 0;

              const user = await prisma.user.upsert({
                where: { googleId },
                update: {},
                create: { 
                  googleId, 
                  email, 
                  name: 'Dev User', 
                  avatarUrl: 'https://via.placeholder.com/150',
                  role: isFirstUser ? Role.ADMIN : undefined,
                },
              });
        
              const sessionToken = jwt.sign(
                { userId: user.id, email: user.email },
                serverConfig.jwtSecret, 
                { expiresIn: '7d' }
              );
        
              res.cookie('token', sessionToken, {
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000,
              });
        
              res.json({ user });
            } catch (error: any) {
              res.status(500).json({ error: 'Dev login failed', details: error.message });
            }
          });
        }
        
        export default router;
