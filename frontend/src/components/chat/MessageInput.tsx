import React, { useState, useRef, useCallback, useEffect } from 'react';
import { apiService } from '../../services/api';
import { socketService } from '../../services/socket';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 120); // Max 120px
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    
    // Limit message length (2000 characters)
    if (value.length <= 2000) {
      setMessage(value);
      adjustTextareaHeight();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        adjustTextareaHeight();
        onMessageSent?.({ content: messageContent, channelId });
      } else {
        // Socket.ioが利用できない場合はHTTP APIを使用
        console.log('📤 Sending message via HTTP API (Socket.io not available)');
        const response = await apiService.sendMessage(channelId, messageContent);
        
        if (response.success && response.data) {
          console.log('✅ Message sent successfully via HTTP API:', response.data);
          setMessage('');
          adjustTextareaHeight();
          onMessageSent?.(response.data);
        }
      }
    } catch (error) {
      console.error('❌ Failed to send message:', error);
    } finally {
      setLoading(false);
    }
  };

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [channelId]);

  // Adjust height on mount
  useEffect(() => {
    adjustTextareaHeight();
  }, [adjustTextareaHeight]);

  const remainingChars = 2000 - message.length;
  const isNearLimit = remainingChars < 100;

  return (
    <div className={`bg-white ${className}`}>
      <div className="p-4">
        {/* Character count warning */}
        {isNearLimit && (
          <div className="mb-2 text-right">
            <span className={`text-xs ${remainingChars < 50 ? 'text-red-500' : 'text-yellow-600'}`}>
              残り {remainingChars} 文字
            </span>
          </div>
        )}

        <div className="flex items-end space-x-3">
          {/* Message input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 resize-none text-sm"
              rows={1}
              disabled={loading}
              style={{ minHeight: '44px' }}
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
            className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 min-w-[44px] min-h-[44px]"
            title="送信 (Enter)"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>

        {/* Helper text */}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>
            Shift+Enter で改行
          </span>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;