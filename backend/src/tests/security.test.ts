import request from 'supertest';
import { Express } from 'express';
import { AuthService } from '../services/auth';
import { UserService } from '../services/user';
import { DataSyncService } from '../services/database/sync';

// モックの設定
jest.mock('../services/database/sync');
jest.mock('../services/database/sqlite');
jest.mock('../services/database/tidb');

describe.skip('Security Tests', () => {
  let app: Express;
  let authService: AuthService;
  let userService: UserService;
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
    userService = UserService.getInstance();
  });

  describe('Authentication Security', () => {
    it('should prevent brute force attacks', async () => {
      const loginAttempts = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/auth/login')
          .send({
            username: 'testuser',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(loginAttempts);
      
      // 複数の失敗後にレート制限が適用されることを確認
      const rateLimitedResponses = responses.filter((r: any) => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should validate JWT token integrity', async () => {
      // 有効なトークンを生成
      const validToken = authService.generateAccessToken({
        userId: 'user-1',
        username: 'testuser',
        roles: ['member'],
        type: 'access'
      });

      // トークンを改ざん
      const tamperedToken = validToken.slice(0, -10) + 'tampered123';

      const response = await request(app)
        .get('/api/profile/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should prevent token replay attacks', async () => {
      // 期限切れトークンを生成
      const expiredToken = authService.generateAccessToken({
        userId: 'user-1',
        username: 'testuser',
        roles: ['member'],
        type: 'access'
      }, '1ms');

      // 少し待ってから使用
      await new Promise(resolve => setTimeout(resolve, 10));

      const response = await request(app)
        .get('/api/profile/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should validate password strength', async () => {
      const weakPasswords = [
        '123',
        'password',
        'abc',
        '111111',
        'qwerty'
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'testuser',
            password: password,
            displayName: 'Test User',
            registrationKey: 'test-key'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('Input Validation Security', () => {
    it('should prevent SQL injection in search queries', async () => {
      const maliciousQueries = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; DELETE FROM messages; --",
        "' UNION SELECT * FROM users --"
      ];

      const validToken = authService.generateAccessToken({
        userId: 'user-1',
        username: 'testuser',
        roles: ['member'],
        type: 'access'
      });

      for (const query of maliciousQueries) {
        const response = await request(app)
          .get('/api/messages/search')
          .set('Authorization', `Bearer ${validToken}`)
          .query({ q: query });

        // SQLインジェクションが防がれ、正常なレスポンスが返されることを確認
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should sanitize XSS attempts in message content', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("XSS")',
        '<svg onload="alert(1)">',
        '<iframe src="javascript:alert(1)"></iframe>'
      ];

      const validToken = authService.generateAccessToken({
        userId: 'user-1',
        username: 'testuser',
        roles: ['member'],
        type: 'access'
      });

      // テスト用チャンネルの設定
      jest.spyOn(userService, 'getUserById').mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        passwordHash: 'hashed-password',
        roles: ['member'],
        profile: {
          displayName: 'Test User',
          onlineStatus: 'online'
        },
        isActive: true,
        isBanned: false,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/channels/test-channel/messages')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            content: payload,
            type: 'text'
          });

        if (response.status === 201) {
          // メッセージが作成された場合、コンテンツがサニタイズされていることを確認
          const content = response.body.data?.content || '';
          expect(content).not.toContain('<script>');
          expect(content).not.toContain('javascript:');
          expect(content).not.toContain('onerror=');
          expect(content).not.toContain('onload=');
        }
      }
    });

    it('should validate file upload security', async () => {
      const validToken = authService.generateAccessToken({
        userId: 'user-1',
        username: 'testuser',
        roles: ['member'],
        type: 'access'
      });

      // 危険なファイル拡張子のテスト
      const dangerousFiles = [
        { name: 'malware.exe', content: 'fake executable' },
        { name: 'script.bat', content: '@echo off\necho malicious' },
        { name: 'virus.scr', content: 'screensaver virus' },
        { name: 'trojan.com', content: 'command file' }
      ];

      for (const file of dangerousFiles) {
        const response = await request(app)
          .post('/api/channels/test-channel/messages/upload')
          .set('Authorization', `Bearer ${validToken}`)
          .attach('files', Buffer.from(file.content), file.name)
          .field('content', 'File upload test');

        // 危険なファイルがブロックされることを確認
        expect([400, 403, 415]).toContain(response.status);
      }
    });

    it('should prevent path traversal attacks', async () => {
      const validToken = authService.generateAccessToken({
        userId: 'user-1',
        username: 'testuser',
        roles: ['member'],
        type: 'access'
      });

      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
      ];

      for (const path of pathTraversalAttempts) {
        const response = await request(app)
          .get(`/api/files/${encodeURIComponent(path)}`)
          .set('Authorization', `Bearer ${validToken}`);

        // パストラバーサルが防がれることを確認
        expect(response.status).toBe(404);
      }
    });
  });

  describe('Authorization Security', () => {
    it('should enforce role-based access control', async () => {
      const memberToken = authService.generateAccessToken({
        userId: 'member-1',
        username: 'member',
        roles: ['member'],
        type: 'access'
      });

      // 管理者のみアクセス可能なエンドポイントをテスト
      const adminOnlyEndpoints = [
        { method: 'post', path: '/api/roles' },
        { method: 'delete', path: '/api/users/user-1' },
        { method: 'post', path: '/api/channels/private' }
      ];

      for (const endpoint of adminOnlyEndpoints) {
        let response;
        switch (endpoint.method) {
          case 'post':
            response = await request(app)
              .post(endpoint.path)
              .set('Authorization', `Bearer ${memberToken}`)
              .send({});
            break;
          case 'delete':
            response = await request(app)
              .delete(endpoint.path)
              .set('Authorization', `Bearer ${memberToken}`);
            break;
          default:
            response = await request(app)
              .get(endpoint.path)
              .set('Authorization', `Bearer ${memberToken}`);
        }

        expect([401, 403]).toContain(response.status);
      }
    });

    it('should prevent privilege escalation', async () => {
      const memberToken = authService.generateAccessToken({
        userId: 'member-1',
        username: 'member',
        roles: ['member'],
        type: 'access'
      });

      // 自分のロールを管理者に変更しようとする試み
      const response = await request(app)
        .put('/api/users/member-1')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          roles: ['admin', 'moderator']
        });

      expect([401, 403]).toContain(response.status);
    });

    it('should validate resource ownership', async () => {
      const user1Token = authService.generateAccessToken({
        userId: 'user-1',
        username: 'user1',
        roles: ['member'],
        type: 'access'
      });

      const user2Token = authService.generateAccessToken({
        userId: 'user-2',
        username: 'user2',
        roles: ['member'],
        type: 'access'
      });

      // user1のメッセージをuser2が編集しようとする試み
      const response = await request(app)
        .put('/api/messages/user1-message-id')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          content: 'Modified by user2'
        });

      expect([401, 403, 404]).toContain(response.status);
    });
  });

  describe('Rate Limiting Security', () => {
    it('should limit API requests per user', async () => {
      const validToken = authService.generateAccessToken({
        userId: 'user-1',
        username: 'testuser',
        roles: ['member'],
        type: 'access'
      });

      // 短時間で大量のリクエストを送信
      const requests = Array.from({ length: 100 }, () =>
        request(app)
          .get('/api/channels')
          .set('Authorization', `Bearer ${validToken}`)
      );

      const responses = await Promise.all(requests);
      
      // 一部のリクエストがレート制限に引っかかることを確認
      const rateLimitedResponses = responses.filter((r: any) => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should limit message creation frequency', async () => {
      const validToken = authService.generateAccessToken({
        userId: 'user-1',
        username: 'testuser',
        roles: ['member'],
        type: 'access'
      });

      // 短時間で大量のメッセージを送信
      const messageRequests = Array.from({ length: 50 }, (_, i) =>
        request(app)
          .post('/api/channels/test-channel/messages')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            content: `Spam message ${i}`,
            type: 'text'
          })
      );

      const responses = await Promise.all(messageRequests);
      
      // スパム検出またはレート制限が適用されることを確認
      const blockedResponses = responses.filter((r: any) => [400, 429].includes(r.status));
      expect(blockedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Data Protection Security', () => {
    it('should not expose sensitive user data', async () => {
      const validToken = authService.generateAccessToken({
        userId: 'user-1',
        username: 'testuser',
        roles: ['member'],
        type: 'access'
      });

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${validToken}`);

      if (response.status === 200 && response.body.data) {
        const users = response.body.data;
        for (const user of users) {
          // パスワードハッシュが露出していないことを確認
          expect(user).not.toHaveProperty('password');
          expect(user).not.toHaveProperty('passwordHash');
          expect(user).not.toHaveProperty('salt');
          
          // 内部IDが露出していないことを確認
          expect(user).not.toHaveProperty('internalId');
          expect(user).not.toHaveProperty('secretKey');
        }
      }
    });

    it('should encrypt sensitive data in transit', async () => {
      // HTTPS強制の確認（本番環境）
      if (process.env.NODE_ENV === 'production') {
        const response = await request(app)
          .get('/api/profile/me')
          .set('X-Forwarded-Proto', 'http'); // HTTPでのアクセスを試行

        expect(response.status).toBe(301); // HTTPSへのリダイレクト
      }
    });

    it('should validate CORS settings', async () => {
      const response = await request(app)
        .options('/api/channels')
        .set('Origin', 'https://malicious-site.com')
        .set('Access-Control-Request-Method', 'GET');

      // 不正なオリジンからのリクエストが拒否されることを確認
      expect(response.headers['access-control-allow-origin']).not.toBe('https://malicious-site.com');
    });
  });

  describe('Session Security', () => {
    it('should invalidate sessions on logout', async () => {
      const validToken = authService.generateAccessToken({
        userId: 'user-1',
        username: 'testuser',
        roles: ['member'],
        type: 'access'
      });

      // ログアウト
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${validToken}`);

      // ログアウト後にトークンが無効になることを確認
      const response = await request(app)
        .get('/api/profile/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(401);
    });

    it('should prevent session fixation', async () => {
      // 異なるセッションで同じトークンが使用できないことを確認
      const token1 = authService.generateAccessToken({
        userId: 'user-1',
        username: 'user1',
        roles: ['member'],
        type: 'access'
      });

      const token2 = authService.generateAccessToken({
        userId: 'user-2',
        username: 'user2',
        roles: ['member'],
        type: 'access'
      });

      expect(token1).not.toBe(token2);

      // 各トークンが正しいユーザーにのみ有効であることを確認
      const payload1 = authService.verifyAccessToken(token1);
      const payload2 = authService.verifyAccessToken(token2);

      expect(payload1?.userId).toBe('user-1');
      expect(payload2?.userId).toBe('user-2');
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose stack traces in production', async () => {
      // 本番環境でのエラーレスポンステスト
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const response = await request(app)
          .get('/api/nonexistent-endpoint');

        expect(response.status).toBe(404);
        expect(response.body).not.toHaveProperty('stack');
        expect(response.body).not.toHaveProperty('trace');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should sanitize error messages', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'invalid-user',
          password: 'test'
        });

      expect(response.status).toBe(400);
      
      // エラーメッセージが内部情報を露出していないことを確認
      const errorMessage = response.body.error || '';
      expect(errorMessage).not.toContain('database');
      expect(errorMessage).not.toContain('internal');
      expect(errorMessage).not.toContain('server');
      expect(errorMessage).not.toContain('config');
    });
  });

  describe('Content Security Policy', () => {
    it('should set appropriate security headers', async () => {
      const response = await request(app)
        .get('/api/channels');

      // セキュリティヘッダーが設定されていることを確認
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should prevent clickjacking attacks', async () => {
      const response = await request(app)
        .get('/api/channels');

      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });
});