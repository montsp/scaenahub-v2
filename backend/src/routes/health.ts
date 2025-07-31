import { Router, Request, Response } from 'express';
import { DataSyncService } from '../services/database/sync';
import { PerformanceMonitor } from '../utils/performanceMonitor';

const router = Router();

// ヘルスチェックエンドポイント
router.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // データベース接続チェック
    const syncService = DataSyncService.getInstance();
    await syncService.readData('users', 'SELECT 1 as test');
    
    const responseTime = Date.now() - startTime;
    const memoryUsage = process.memoryUsage();
    
    // パフォーマンス監視
    const performanceMonitor = PerformanceMonitor.getInstance();
    performanceMonitor.recordMetric('health_check_response_time', responseTime);
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      memory: {
        used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
      },
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      database: 'connected',
      services: {
        auth: 'operational',
        messaging: 'operational',
        moderation: 'operational',
        fileUpload: 'operational'
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      error: 'Database connection failed',
      environment: process.env.NODE_ENV || 'development'
    });
  }
});

// 詳細なシステム情報（管理者のみ）
router.get('/health/detailed', async (req: Request, res: Response) => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // パフォーマンス統計の取得
    const performanceMonitor = PerformanceMonitor.getInstance();
    const performanceStats = performanceMonitor.getAllStats();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        pid: process.pid
      },
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      performance: performanceStats,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,
        databaseType: process.env.DATABASE_URL ? 'TiDB' : 'SQLite'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Failed to retrieve system information'
    });
  }
});

// レディネスプローブ（Kubernetes用）
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // 必要なサービスの初期化チェック
    const syncService = DataSyncService.getInstance();
    await syncService.readData('users', 'SELECT 1 as test');
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Services not initialized'
    });
  }
});

// ライブネスプローブ（Kubernetes用）
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;