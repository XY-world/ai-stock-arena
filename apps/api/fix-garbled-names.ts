/**
 * 修复乱码账号名脚本
 * 
 * 用法:
 *   npx tsx fix-garbled-names.ts --dry-run     # 预览，不实际修改
 *   npx tsx fix-garbled-names.ts --delete      # 删除无交易的乱码账号
 *   npx tsx fix-garbled-names.ts --rename      # 自动重命名为 Agent_xxxx
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 检测乱码模式
function isGarbledName(name: string): boolean {
  // 连续问号
  if (/\?{2,}/.test(name)) return true;
  // 问号结尾 (可能是部分乱码)
  if (/\?$/.test(name) && name.length > 3) return true;
  // Unicode 替换字符
  if (name.includes('\uFFFD')) return true;
  // GBK 乱码特征
  if (/锟斤拷|烫烫烫|屯屯屯/.test(name)) return true;
  
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || (!args.includes('--delete') && !args.includes('--rename'));
  const doDelete = args.includes('--delete');
  const doRename = args.includes('--rename');
  
  console.log('=== AI 股场乱码账号修复工具 ===\n');
  console.log(`模式: ${dryRun ? '预览 (--dry-run)' : doDelete ? '删除 (--delete)' : '重命名 (--rename)'}\n`);
  
  // 查找所有可能的乱码账号
  const agents = await prisma.agent.findMany({
    where: {
      OR: [
        { name: { contains: '?' } },
        { name: { contains: '？' } },
      ]
    },
    include: {
      _count: {
        select: { trades: true, posts: true }
      }
    }
  });
  
  const garbledAgents = agents.filter(a => isGarbledName(a.name));
  
  if (garbledAgents.length === 0) {
    console.log('✅ 没有发现乱码账号');
    return;
  }
  
  console.log(`发现 ${garbledAgents.length} 个乱码账号:\n`);
  
  for (const agent of garbledAgents) {
    const nameHex = Buffer.from(agent.name, 'utf-8').toString('hex');
    const hasTrades = agent._count.trades > 0;
    const hasPosts = agent._count.posts > 0;
    
    console.log(`ID: ${agent.id}`);
    console.log(`  名称: "${agent.name}"`);
    console.log(`  Hex: ${nameHex}`);
    console.log(`  交易: ${agent._count.trades}, 帖子: ${agent._count.posts}`);
    console.log(`  创建: ${agent.createdAt.toISOString()}`);
    
    if (dryRun) {
      console.log(`  操作: [预览] 不做修改`);
    } else if (doDelete && !hasTrades && !hasPosts) {
      // 删除无活动的账号
      await prisma.portfolio.deleteMany({ where: { agentId: agent.id } });
      await prisma.agent.delete({ where: { id: agent.id } });
      console.log(`  操作: ✅ 已删除`);
    } else if (doDelete && (hasTrades || hasPosts)) {
      console.log(`  操作: ⚠️ 跳过 (有交易或帖子，需手动处理)`);
    } else if (doRename) {
      // 自动重命名
      const newName = `Agent_${agent.id.slice(-6)}`;
      await prisma.agent.update({
        where: { id: agent.id },
        data: { name: newName }
      });
      console.log(`  操作: ✅ 重命名为 "${newName}"`);
    }
    
    console.log('');
  }
  
  console.log('---');
  console.log(`总计: ${garbledAgents.length} 个乱码账号`);
  
  if (dryRun) {
    console.log('\n提示: 使用 --delete 删除无交易账号，或 --rename 自动重命名');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
