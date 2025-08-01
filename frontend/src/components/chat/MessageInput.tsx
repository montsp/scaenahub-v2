import React, { useState, useCallback, useEffect } from 'react';
import { apiService } from '../../services/api';
import { socketService } from '../../services/socket';
import MentionInput from './MentionInput';

interface MessageInputProps {
  channelId: string;
  onMessageSent?: (message: any) => void;
  placeholder?: string;
  className?: string;
}

const MessageInput: React.FC<MessageInputProps> = ({
  channelId,
  onMessageSent,
  placeholder = 'メッセージを入力... (Shift+Enterで改行)',
  className = '',
}) => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || loading) return;

    const messageContent = message.trim();

    try {
      setLoading(true);
      
      // Socket.ioでメッセージを送信（リアルタイム更新のため）
      const socket = socketService.getSocket();
      if (socket && socket.connected) {
        console.log('📤 Sending message via Socket.io:', messageContent);
        socket.emit('send_message', {
          channelId,
          content: messageContent,
          type: 'text'
        });
        
        // メッセージ送信成功
        console.log('✅ Message sent via Socket.io');
        setMessage('');
        onMessageSent?.({ content: messageContent, channelId });
      } else {
        // Socket.ioが利用できない場合はHTTP APIを使用
        console.log('📤 Sending message via HTTP API (Socket.io not available)');
        const response = await apiService.sendMessage(channelId, messageContent);
        
        if (response.success && response.data) {
          console.log('✅ Message sent successfully via HTTP API:', response.data);
          setMessage('');
          onMessageSent?.(response.data);
        }
      }
    } catch (error) {
      console.error('❌ Failed to send message:', error);
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className={`bg-white border-t border-gray-200 ${className}`}>
      <div className="p-3 sm:p-4">
        <div className="flex items-end space-x-2 sm:space-x-3">
          {/* Message input with mentions */}
          <div className="flex-1 relative">
            <MentionInput
              value={message}
              onChange={setMessage}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={loading}
              maxLength={2000}
            />
            
            {/* Loading overlay */}
            {loading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
                <div className="flex items-center text-sm text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  送信中...
                </div>
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={handleSendMessage}
            disabled={!message.trim() || loading}
            className="p-2 sm:p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="送信 (Enter)"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;