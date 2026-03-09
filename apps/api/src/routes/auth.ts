import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// ============================================
// OAuth Routes
// ============================================

export async function authRoutes(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  
  // ============================================
  // GitHub OAuth
  // ============================================
  
  app.get('/github', async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    
    if (!clientId) {
      return reply.status(500).send({
        success: false,
        error: { code: 'NOT_CONFIGURED', message: 'GitHub OAuth not configured' },
      });
    }
    
    const redirectUri = `${process.env.API_URL || 'http://localhost:3000'}/v1/auth/github/callback`;
    const scope = 'read:user user:email';
    
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    
    return reply.redirect(url);
  });
  
  app.get('/github/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.query as { code?: string };
    
    if (!code) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_CODE', message: 'Missing authorization code' },
      });
    }
    
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return reply.status(500).send({
        success: false,
        error: { code: 'NOT_CONFIGURED', message: 'GitHub OAuth not configured' },
      });
    }
    
    try {
      // Exchange code for token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });
      
      const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
      
      if (!tokenData.access_token) {
        throw new Error(tokenData.error || 'Failed to get access token');
      }
      
      // Get user info
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
        },
      });
      
      const githubUser = await userRes.json() as {
        id: number;
        login: string;
        name?: string;
        email?: string;
        avatar_url?: string;
      };
      
      // Get email if not public
      let email = githubUser.email;
      if (!email) {
        const emailRes = await fetch('https://api.github.com/user/emails', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json',
          },
        });
        const emails = await emailRes.json() as { email: string; primary: boolean }[];
        const primary = emails.find(e => e.primary);
        email = primary?.email || emails[0]?.email;
      }
      
      if (!email) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_EMAIL', message: 'Could not get email from GitHub' },
        });
      }
      
      // Upsert user
      const user = await prisma.user.upsert({
        where: {
          provider_providerId: {
            provider: 'github',
            providerId: String(githubUser.id),
          },
        },
        create: {
          email,
          name: githubUser.name || githubUser.login,
          avatar: githubUser.avatar_url,
          provider: 'github',
          providerId: String(githubUser.id),
        },
        update: {
          email,
          name: githubUser.name || githubUser.login,
          avatar: githubUser.avatar_url,
        },
      });
      
      // Generate JWT
      const token = app.jwt.sign({
        id: user.id,
        email: user.email,
        name: user.name,
      }, { expiresIn: '7d' });
      
      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      return reply.redirect(`${frontendUrl}/auth/callback?token=${token}`);
      
    } catch (error: any) {
      console.error('GitHub OAuth error:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'OAUTH_ERROR', message: error.message },
      });
    }
  });
  
  // ============================================
  // Google OAuth
  // ============================================
  
  app.get('/google', async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      return reply.status(500).send({
        success: false,
        error: { code: 'NOT_CONFIGURED', message: 'Google OAuth not configured' },
      });
    }
    
    const redirectUri = `${process.env.API_URL || 'http://localhost:3000'}/v1/auth/google/callback`;
    const scope = 'email profile';
    
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
    
    return reply.redirect(url);
  });
  
  app.get('/google/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.query as { code?: string };
    
    if (!code) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_CODE', message: 'Missing authorization code' },
      });
    }
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return reply.status(500).send({
        success: false,
        error: { code: 'NOT_CONFIGURED', message: 'Google OAuth not configured' },
      });
    }
    
    try {
      const redirectUri = `${process.env.API_URL || 'http://localhost:3000'}/v1/auth/google/callback`;
      
      // Exchange code for token
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      
      const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
      
      if (!tokenData.access_token) {
        throw new Error(tokenData.error || 'Failed to get access token');
      }
      
      // Get user info
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });
      
      const googleUser = await userRes.json() as {
        id: string;
        email: string;
        name?: string;
        picture?: string;
      };
      
      // Upsert user
      const user = await prisma.user.upsert({
        where: {
          provider_providerId: {
            provider: 'google',
            providerId: googleUser.id,
          },
        },
        create: {
          email: googleUser.email,
          name: googleUser.name,
          avatar: googleUser.picture,
          provider: 'google',
          providerId: googleUser.id,
        },
        update: {
          email: googleUser.email,
          name: googleUser.name,
          avatar: googleUser.picture,
        },
      });
      
      // Generate JWT
      const token = app.jwt.sign({
        id: user.id,
        email: user.email,
        name: user.name,
      }, { expiresIn: '7d' });
      
      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      return reply.redirect(`${frontendUrl}/auth/callback?token=${token}`);
      
    } catch (error: any) {
      console.error('Google OAuth error:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'OAUTH_ERROR', message: error.message },
      });
    }
  });
  
  // ============================================
  // Current User
  // ============================================
  
  app.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as { id: string };
      
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          createdAt: true,
          _count: {
            select: { agents: true },
          },
        },
      });
      
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
      }
      
      return {
        success: true,
        data: user,
      };
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
    }
  });
  
  // ============================================
  // Logout (client-side, just return success)
  // ============================================
  
  app.post('/logout', async () => {
    return { success: true };
  });
}
