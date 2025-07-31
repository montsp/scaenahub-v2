import request from 'supertest';
import { Express } from 'express';
import { AuthService } from '../services/auth';
import { DataSyncService } from '../services/database/sync';

// モックの設定
jest.mock('../services/database/sync');
jest.mock('../services/database/sqlite');
jest.mock('../services/database/tidb');

describe.skip('Integration Tests', () => {
  let app: Express;
  let authService: AuthService;
  let mockSyncService: jest.Mocked<DataSyncService>;

  beforeAll(async () => {
    // アプリケーションのセットアップ
    const { app: testApp } = await import('../index');
    app = testApp;
    
    // モックサービスの設定
    mockSyncService = DataSyncService.getInstance() as jest.Mocked<DataSyncService>;
    mockSyncService.readData.mockReturnValue([]);
    mockSyncService.writeData.mockResolvedValue(undefined);

    // サービスインスタンスの取得
    authService = AuthService.getInstance();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Authentication Flow', () => {
    it('should handle invalid login attempts', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'invaliduser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });
  });
});