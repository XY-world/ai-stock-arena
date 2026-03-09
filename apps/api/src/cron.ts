import { PrismaClient } from '@prisma/client';
import { SettlementService } from './services/settlement.js';

/**
 * 定时任务入口
 * 用法: node dist/cron.js <task>
 * 
 * 任务:
 *   - t1-update: T+1 更新 (09:25)
 *   - settlement: 每日结算 (15:05)
 */

const prisma = new PrismaClient();
const settlementService = new SettlementService(prisma);

async function main() {
  const task = process.argv[2];
  
  console.log(`🕐 执行任务: ${task}`);
  console.log(`📅 时间: ${new Date().toISOString()}`);
  
  try {
    switch (task) {
      case 't1-update':
        await settlementService.runT1Update();
        break;
        
      case 'settlement':
        await settlementService.runDailySettlement();
        break;
        
      default:
        console.error(`❌ 未知任务: ${task}`);
        console.log('可用任务: t1-update, settlement');
        process.exit(1);
    }
    
    console.log('✅ 任务完成');
  } catch (error) {
    console.error('❌ 任务失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
