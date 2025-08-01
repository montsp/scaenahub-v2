import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  connect(token: string) {
    if (this.socket) {
      this.disconnect();
    }

    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    this.socket = io(baseURL, {
      auth: {
        token
      },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('🔗 Socket connected');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('🚪 Socket disconnected');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      this.isConnected = false;
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  getSocket() {
    return this.socket;
  }

  isSocketConnected() {
    return this.isConnected && this.socket?.connected;
  }

  // Channel methods
  joinChannel(channelId: string) {
    if (this.socket) {
      this.socket.emit('join-channel', channelId);
    }
  }

  leaveChannel(channelId: string) {
    if (this.socket) {
      this.socket.emit('leave-channel', channelId);
    }
  }

  // Message events
  sendMessage(channelId: string, content: string, options?: { parentMessageId?: string }) {
    if (this.socket) {
      this.socket.emit('send_message', {
        channelId,
        content,
        ...options
      });
    }
  }

  onMessage(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on('message', callback);
    }
  }

  onMessageUpdated(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on('message-updated', callback);
    }
  }

  onMessageDeleted(callback: (messageId: string) => void) {
    if (this.socket) {
      this.socket.on('message-deleted', callback);
    }
  }

  // Thread events
  onThreadReply(callback: (data: { parentMessageId: string; reply: any }) => void) {
    if (this.socket) {
      this.socket.on('thread_reply', callback);
    }
  }

  // Typing indicators
  startTyping(channelId: string) {
    if (this.socket) {
      this.socket.emit('typing-start', channelId);
    }
  }

  stopTyping(channelId: string) {
    if (this.socket) {
      this.socket.emit('typing-stop', channelId);
    }
  }

  onTypingStart(callback: (data: { userId: string; channelId: string }) => void) {
    if (this.socket) {
      this.socket.on('typing-start', callback);
    }
  }

  onTypingStop(callback: (data: { userId: string; channelId: string }) => void) {
    if (this.socket) {
      this.socket.on('typing-stop', callback);
    }
  }

  // Presence events
  onUserOnline(callback: (userId: string) => void) {
    if (this.socket) {
      this.socket.on('user-online', callback);
    }
  }

  onUserOffline(callback: (userId: string) => void) {
    if (this.socket) {
      this.socket.on('user-offline', callback);
    }
  }

  // Remove event listeners
  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export const socketService = new SocketService();
export default socketService;