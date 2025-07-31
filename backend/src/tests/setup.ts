// テスト環境のセットアップ
import dotenv from 'dotenv';

// テスト用環境変数を設定
dotenv.config({ path: '.env.test' });

// 環境変数のデフォルト値を設定
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';
process.env.REGISTRATION_KEY = 'test-registration-key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

// コンソールログを抑制（必要に応じて）
if (process.env.SUPPRESS_TEST_LOGS === 'true') {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
}

// グローバルなテスト設定
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});