import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'express-validator';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string | undefined;
  details?: any;
}

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string | undefined;
  public details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string,
    details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationErrorHandler extends CustomError {
  constructor(errors: any[]) {
    const message = 'Validation failed';
    const details = errors.map(error => ({
      field: error.param || error.path,
      message: error.msg || error.message,
      value: error.value,
      location: error.location || error.type
    }));
    super(message, 400, true, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends CustomError {
  constructor(message: string = 'Access denied') {
    super(message, 403, true, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends CustomError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, true, 'NOT_FOUND_ERROR');
  }
}

export class ConflictError extends CustomError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, true, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends CustomError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, true, 'RATE_LIMIT_ERROR');
  }
}

export class DatabaseError extends CustomError {
  constructor(message: string = 'Database operation failed', originalError?: Error) {
    super(message, 500, true, 'DATABASE_ERROR', {
      originalError: originalError?.message,
      stack: originalError?.stack
    });
  }
}

export class ExternalServiceError extends CustomError {
  constructor(service: string, message: string = 'External service error') {
    super(`${service}: ${message}`, 502, true, 'EXTERNAL_SERVICE_ERROR', { service });
  }
}

// エラーハンドリングミドルウェア
export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // ログ出力
  logError(error, req);

  // 本番環境では詳細なエラー情報を隠す
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isOperational = error.isOperational || false;

  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';
  let code = error.code;
  let details = error.details;

  // 非運用エラー（プログラミングエラー）の場合
  if (!isOperational) {
    statusCode = 500;
    message = isDevelopment ? error.message : 'Internal Server Error';
    code = 'INTERNAL_ERROR';
    details = isDevelopment ? { stack: error.stack } : undefined;
  }

  // 本番環境では内部エラーの詳細を隠す
  if (!isDevelopment && statusCode >= 500) {
    message = 'Internal Server Error';
    details = undefined;
  }

  // レスポンス送信
  const errorResponse: any = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  if (code) errorResponse.code = code;
  if (details) errorResponse.details = details;
  if (isDevelopment && error.stack) errorResponse.stack = error.stack;

  res.status(statusCode).json(errorResponse);
};

// 404エラーハンドラー
export const notFoundHandler = (req: Request, res: Response): void => {
  const error = new NotFoundError('Endpoint');
  res.status(404).json({
    success: false,
    error: error.message,
    code: error.code,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
};

// 非同期エラーキャッチャー
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// エラーログ出力
const logError = (error: AppError, req: Request): void => {
  const logData = {
    timestamp: new Date().toISOString(),
    level: error.statusCode && error.statusCode < 500 ? 'warn' : 'error',
    message: error.message,
    statusCode: error.statusCode,
    code: error.code,
    path: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: (req as any).user?.id,
    stack: error.stack,
    details: error.details
  };

  if (error.statusCode && error.statusCode < 500) {
    console.warn('Client Error:', JSON.stringify(logData, null, 2));
  } else {
    console.error('Server Error:', JSON.stringify(logData, null, 2));
  }

  // 本番環境では外部ログサービスに送信
  if (process.env.NODE_ENV === 'production') {
    // 例: Sentry, CloudWatch, etc.
    // sendToExternalLogger(logData);
  }
};

// プロセス終了時のエラーハンドリング
export const setupGlobalErrorHandlers = (): void => {
  // 未処理の Promise rejection
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // アプリケーションを安全に終了
    process.exit(1);
  });

  // 未処理の例外
  process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught Exception:', error);
    // アプリケーションを安全に終了
    process.exit(1);
  });

  // SIGTERM シグナル（Dockerなどからの終了要求）
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
  });

  // SIGINT シグナル（Ctrl+C）
  process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    process.exit(0);
  });
};

// ヘルスチェック用のエラー統計
export class ErrorStats {
  private static instance: ErrorStats;
  private errorCounts: Map<string, number> = new Map();
  private lastReset: Date = new Date();

  public static getInstance(): ErrorStats {
    if (!ErrorStats.instance) {
      ErrorStats.instance = new ErrorStats();
    }
    return ErrorStats.instance;
  }

  public recordError(code: string): void {
    const current = this.errorCounts.get(code) || 0;
    this.errorCounts.set(code, current + 1);
  }

  public getStats(): {
    errorCounts: Record<string, number>;
    totalErrors: number;
    lastReset: Date;
  } {
    const errorCounts: Record<string, number> = {};
    let totalErrors = 0;

    for (const [code, count] of this.errorCounts.entries()) {
      errorCounts[code] = count;
      totalErrors += count;
    }

    return {
      errorCounts,
      totalErrors,
      lastReset: this.lastReset
    };
  }

  public reset(): void {
    this.errorCounts.clear();
    this.lastReset = new Date();
  }
}

// リクエスト情報をログに記録するミドルウェア
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  // レスポンス完了時にログ出力
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: (req as any).user?.id
    };

    if (res.statusCode >= 400) {
      console.warn('Request Warning:', JSON.stringify(logData));
    } else {
      console.log('Request Info:', JSON.stringify(logData));
    }
  });

  next();
};

// セキュリティヘッダー設定
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // XSS保護
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // コンテンツタイプスニッフィング防止
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // フレーム埋め込み防止
  res.setHeader('X-Frame-Options', 'DENY');
  // HTTPS強制（本番環境）
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // CSP設定
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
  );

  next();
};