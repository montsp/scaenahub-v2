import { performance } from 'perf_hooks';
import { AuthService } from '../services/auth';
import { DataSyncService } from '../services/database/sync';
import { PerformanceMonitor } from '../utils/performanceMonitor';

// モック設定
const mockSyncService = {
  readData: jest.fn(),
  writeData: jest.fn(),
  getInstance: jest.fn()
};

jest.mock('../services/database/sync', () => ({
  DataSyncService: {
    getInstance: () => mockSyncService
  }
}));

jest.mock('../services/database/sqlite');
jest.mock('../services/database/tidb');

describe('Performance Tests', () => {
  let authService: AuthService;

  // パフォーマンス測定用のヘルパー
  const measurePerformance = async <T>(
    name: string,
    fn: () => Promise<T>,
    maxDuration: number = 1000
  ): Promise<{ result: T; duration: number; passed: boolean }> => {
    const startTime = performance.now();
    const result = await fn();
    const endTime = performance.now();
    const duration = endTime - startTime;
    const passed = duration <= maxDuration;

    console.log(`Performance Test: ${name}`);
    console.log(`Duration: ${duration.toFixed(2)}ms (Max: ${maxDuration}ms)`);
    console.log(`Status: ${passed ? 'PASSED' : 'FAILED'}`);
    console.log('---');

    return { result, duration, passed };
  };

  beforeAll(() => {
    // サービスインスタンスの取得
    authService = AuthService.getInstance();

    // 基本的なモック設定
    mockSyncService.readData.mockReturnValue([]);
    mockSyncService.writeData.mockResolvedValue(undefined);
  });

  describe('Authentication Performance', () => {
    it('should generate tokens efficiently', async () => {
      const { passed } = await measurePerformance(
        'Generate 100 JWT tokens',
        async () => {
          const tokens = Array.from({ length: 100 }, (_, i) =>
            authService.generateAccessToken({
              userId: `user-${i}`,
              username: `user${i}`,
              roles: ['member'],
              type: 'access'
            })
          );
          return tokens;
        },
        1000 // 1秒以内
      );

      expect(passed).toBe(true);
    });

    it('should verify tokens efficiently', async () => {
      const token = authService.generateAccessToken({
        userId: 'user1',
        username: 'testuser',
        roles: ['member'],
        type: 'access'
      });

      const { passed } = await measurePerformance(
        'Verify 100 JWT tokens',
        async () => {
          const verifications = Array.from({ length: 100 }, () =>
            authService.verifyAccessToken(token)
          );
          return verifications;
        },
        500 // 500ms以内
      );

      expect(passed).toBe(true);
    });
  });

  describe('Database Performance', () => {
    it('should execute simple queries efficiently', async () => {
      const { passed } = await measurePerformance(
        'Simple database query (50 executions)',
        async () => {
          const results = [];
          for (let i = 0; i < 50; i++) {
            const result = mockSyncService.readData('test_table', 'SELECT * FROM test_table WHERE id = ?', [`id-${i}`]);
            results.push(result);
          }
          return results;
        },
        200 // 200ms以内
      );

      expect(passed).toBe(true);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during operations', async () => {
      const initialMemory = process.memoryUsage();

      // 大量の操作を実行
      for (let i = 0; i < 1000; i++) {
        authService.generateAccessToken({
          userId: `user-${i}`,
          username: `user${i}`,
          roles: ['member'],
          type: 'access'
        });
      }

      // ガベージコレクションを強制実行
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseInMB = memoryIncrease / 1024 / 1024;

      console.log(`Memory increase: ${memoryIncreaseInMB.toFixed(2)}MB`);

      // メモリ増加が10MB以下であることを確認
      expect(memoryIncreaseInMB).toBeLessThan(10);
    });
  });

  describe('Performance Monitoring', () => {
    it('should record and retrieve performance metrics', () => {
      const monitor = PerformanceMonitor.getInstance();
      
      // メトリクスを記録
      monitor.recordMetric('test_metric', 100);
      monitor.recordMetric('test_metric', 200);
      monitor.recordMetric('test_metric', 150);

      const stats = monitor.getStats('test_metric');
      
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(3);
      expect(stats?.average).toBe(150);
      expect(stats?.min).toBe(100);
      expect(stats?.max).toBe(200);
    });
  });
});