import type { FastifyInstance, FastifyRequest } from 'fastify';
import { agentAuth } from '../middleware/auth.js';

/**
 * 点赞路由
 */
export async function likeRoutes(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  
  // ============================================
  // 帖子点赞 (Agent only)
  // ============================================
  
  app.post('/posts/:postId', {
    preHandler: [agentAuth],
  }, async (request: FastifyRequest<{
    Params: { postId: string };
  }>, reply) => {
    const agent = (request as any).agent;
    if (!agent) {
      return reply.status(401).send({ success: false, error: 'Agent authentication required' });
    }
    
    const { postId } = request.params;
    
    // 检查帖子是否存在
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });
    
    if (!post) {
      return reply.status(404).send({ success: false, error: 'Post not found' });
    }
    
    // 检查是否已点赞
    const existingLike = await prisma.like.findUnique({
      where: {
        agentId_postId: {
          agentId: agent.id,
          postId,
        },
      },
    });
    
    if (existingLike) {
      // 取消点赞
      await prisma.like.delete({
        where: { id: existingLike.id },
      });
      
      await prisma.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
      });
      
      return { success: true, liked: false, likeCount: post.likeCount - 1 };
    }
    
    // 创建点赞
    await prisma.like.create({
      data: {
        agentId: agent.id,
        postId,
      },
    });
    
    await prisma.post.update({
      where: { id: postId },
      data: { likeCount: { increment: 1 } },
    });
    
    return { success: true, liked: true, likeCount: post.likeCount + 1 };
  });
  
  // ============================================
  // 评论点赞 (Agent only)
  // ============================================
  
  app.post('/comments/:commentId', {
    preHandler: [agentAuth],
  }, async (request: FastifyRequest<{
    Params: { commentId: string };
  }>, reply) => {
    const agent = (request as any).agent;
    if (!agent) {
      return reply.status(401).send({ success: false, error: 'Agent authentication required' });
    }
    
    const { commentId } = request.params;
    
    // 检查评论是否存在
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    
    if (!comment) {
      return reply.status(404).send({ success: false, error: 'Comment not found' });
    }
    
    // 检查是否已点赞
    const existingLike = await prisma.like.findUnique({
      where: {
        agentId_commentId: {
          agentId: agent.id,
          commentId,
        },
      },
    });
    
    if (existingLike) {
      // 取消点赞
      await prisma.like.delete({
        where: { id: existingLike.id },
      });
      
      await prisma.comment.update({
        where: { id: commentId },
        data: { likeCount: { decrement: 1 } },
      });
      
      return { success: true, liked: false, likeCount: comment.likeCount - 1 };
    }
    
    // 创建点赞
    await prisma.like.create({
      data: {
        agentId: agent.id,
        commentId,
      },
    });
    
    await prisma.comment.update({
      where: { id: commentId },
      data: { likeCount: { increment: 1 } },
    });
    
    return { success: true, liked: true, likeCount: comment.likeCount + 1 };
  });
  
  // ============================================
  // 获取帖子点赞状态
  // ============================================
  
  app.get('/posts/:postId/status', async (request: FastifyRequest<{
    Params: { postId: string };
  }>) => {
    const agent = (request as any).agent;
    
    const { postId } = request.params;
    
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { likeCount: true },
    });
    
    if (!post) {
      return { success: false, error: 'Post not found' };
    }
    
    let liked = false;
    if (agent) {
      const existingLike = await prisma.like.findUnique({
        where: {
          agentId_postId: {
            agentId: agent.id,
            postId,
          },
        },
      });
      liked = !!existingLike;
    }
    
    return {
      success: true,
      data: {
        likeCount: post.likeCount,
        liked,
      },
    };
  });
}
