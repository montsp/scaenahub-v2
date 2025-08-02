import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { DataSyncService } from './services/database/sync';
import { errorHandler, notFoundHandler, requestLogger, securityHeaders, setupGlobalErrorHandlers } from './middleware/errorHandler';

// ルートインポート
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import profileRoutes from './routes/profile';
import roleRoutes from './routes/roles';
import channelRoutes from './routes/channels';
import scriptRoutes from './routes/scripts';
import messageRoutes from './routes/messages';
import moderationRoutes from './routes/moderation';
import healthRoutes from './routes/health';

// Socket.ioハンドラーとミドルウェア
import { PresenceHandler } from './socket/handlers/presence';
import { MessageHandler } from './socket/handlers/message';
import { SocketAuthMiddleware } from './socket/middleware/auth';

// 環境変数を読み込み（一度だけ）
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// ミドルウェア設定
app.use(helmet());
app.use(securityHeaders);
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "http://localhost:5174"
  ],
  credentials: true
}));
app.use(morgan('combined'));
app.use(requestLogger);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// APIルート設定
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/scripts', scriptRoutes);
app.use('/api/admin', require('./routes/admin').default);
app.use('/api', messageRoutes);
app.use('/api/moderation', moderationRoutes);

// ヘルスチェックルート
app.use('/health', healthRoutes);

// エラーハンドリング
app.use(notFoundHandler);
app.use(errorHandler);

// Socket.io設定
const socketAuthMiddleware = new SocketAuthMiddleware();
const presenceHandler = new PresenceHandler();
const messageHandler = new MessageHandler();

// Socket.ioインスタンスをハンドラーに注入
presenceHandler.setSocketIO(io);

// Socket.ioミドルウェア設定
io.use(socketAuthMiddleware.authenticate());
io.use(socketAuthMiddleware.connectionLimit(5)); // ユーザーあたり最大5接続
io.use(socketAuthMiddleware.errorHandler());

// Socket.io接続処理
io.on('connection', async (socket) => {
  const authenticatedSocket = socket as any;
  console.log(`Socket connected: ${socket.id} for user ${authenticatedSocket.username}`);
  
  try {
    // プレゼンス処理
    await presenceHandler.handleConnection(authenticatedSocket);
    
    // メッセージハンドラー設定
    messageHandler.setupMessageHandlers(authenticatedSocket);
    
    // ユーザー固有のルームに参加（メンション通知用）
    await messageHandler.joinUserRoom(authenticatedSocket);
    
    // 切断処理
    socket.on('disconnect', async (reason) => {
      console.log(`Socket disconnected: ${socket.id} for user ${authenticatedSocket.username}, reason: ${reason}`);
      
      try {
        // プレゼンス処理
        await presenceHandler.handleDisconnection(authenticatedSocket);
        
        // ユーザールームから離脱
        await messageHandler.leaveUserRoom(authenticatedSocket);
        
      } catch (error) {
        console.error('Socket disconnection error:', error);
      }
    });

    // エラーハンドリング
    socket.on('error', (error) => {
      console.error(`Socket error for user ${authenticatedSocket.username}:`, error);
    });

    // 接続成功通知
    socket.emit('connected', {
      message: 'Successfully connected to ScaenaHub',
      userId: authenticatedSocket.userId,
      username: authenticatedSocket.username,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Socket connection setup error:', error);
    socket.emit('error', { message: 'Connection setup failed' });
    socket.disconnect();
  }
});

// データベース初期化とサーバー起動
async function startServer() {
  try {
    // グローバルエラーハンドラーの設定
    setupGlobalErrorHandlers();
    
    // データ同期サービス初期化
    const syncService = DataSyncService.getInstance();
    await syncService.initialize();
    
    // 高度な同期機能を初期化
    await syncService.initializeAdvancedFeatures();
    await syncService.startBidirectionalSync();
    syncService.startResourceMonitoring();
    
    // プロフィールサービス初期化
    const { ProfileService } = await import('./services/profile');
    const profileService = ProfileService.getInstance();
    profileService.startPeriodicCleanup();
    
    // ロールサービス初期化とデフォルトロール作成
    const { RoleService } = await import('./services/role');
    const roleService = RoleService.getInstance();
    await roleService.initializeDefaultRoles();
    
    // チャンネルサービス初期化とデフォルトチャンネル作成
    const { ChannelService } = await import('./services/channel');
    const channelService = ChannelService.getInstance();
    await channelService.initializeDefaultChannels();
    
    // モデレーションサービス初期化とデフォルトルール作成
    const { ModerationService } = await import('./services/moderation');
    const moderationService = ModerationService.getInstance();
    await moderationService.initialize();
    
    // サーバー起動
    server.listen(PORT, () => {
      console.log(`🚀 ScaenaHub v2 Backend Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔄 Database sync service: ${syncService.getConnectionStatus().tidb ? 'Online' : 'Offline'} mode`);
      console.log(`👤 Profile service: Initialized with periodic cleanup`);
      console.log(`🔐 Role service: Default roles initialized`);
      console.log(`📺 Channel service: Default channels initialized`);
      console.log(`🛡️ Moderation service: Default rules initialized`);
    });
    
    // グレースフルシャットダウン
    process.on('SIGTERM', async () => {
      console.log('🛑 Received SIGTERM, shutting down gracefully...');
      await syncService.cleanup();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      console.log('🛑 Received SIGINT, shutting down gracefully...');
      await syncService.shutdown();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app, io };