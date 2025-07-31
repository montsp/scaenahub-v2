import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, User } from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { useApi } from '../../hooks/useApi';

interface MessageListProps {
  channelId: string;
  className?: string;
}

interface MessageItemProps {
  message: Message;
  currentUser: User;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  currentUser,
  onEdit,
  onDelete,
  onReaction,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showActions, setShowActions] = useState(false);

  const isOwnMessage = message.userId === currentUser.id;
  const canEdit = isOwnMessage || currentUser.roles?.includes('admin') || currentUser.roles?.includes('moderator');
  const canDelete = isOwnMessage || currentUser.roles?.includes('admin') || currentUser.roles?.includes('moderator');

  const handleEdit = () => {
    if (onEdit && editContent.trim() !== message.content) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditContent(message.content);
    }
  };

  const formatTime = (dateString: Date | string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const userDisplayName = message.user?.profile?.displayName || message.user?.username || 'Unknown User';
  const userInitial = userDisplayName.charAt(0).toUpperCase();

  return (
    <div
      className="group p-4 hover:bg-gray-50 transition-colors duration-200"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex space-x-3">
        {/* User Avatar */}
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
          {userInitial}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          {/* Message Header */}
          <div className="flex items-center space-x-2 mb-1">
            <span className="font-medium text-gray-900">{userDisplayName}</span>
            <span className="text-xs text-gray-500">{formatTime(message.createdAt)}</span>
            {message.editedAt && (
              <span className="text-xs text-gray-400">(編集済み)</span>
            )}
          </div>

          {/* Message Body */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={3}
                autoFocus
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleEdit}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(message.content);
                  }}
                  className="px-3 py-1 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-800">
              {message.content}
            </div>
          )}

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {message.reactions.map((reaction, index) => (
                <button
                  key={index}
                  onClick={() => onReaction?.(message.id, reaction.emoji)}
                  className="inline-flex items-center px-2 py-1 text-xs rounded-full border bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 transition-colors duration-200"
                >
                  <span className="mr-1">{reaction.emoji}</span>
                  <span>{reaction.count || 1}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message Actions */}
        {showActions && (
          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {canEdit && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                title="編集"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete?.(message.id)}
                className="p-1 text-gray-400 hover:text-red-600 transition-colors duration-200"
                title="削除"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const MessageList: React.FC<MessageListProps> = ({ 
  channelId, 
  className = '' 
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const {
    data: messagesData,
    loading,
    error,
    execute: fetchMessages,
  } = useApi(apiService.getMessages);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Socket for real-time updates
  const { joinChannel, leaveChannel } = useSocket({
    onMessage: useCallback((message: Message) => {
      console.log('📨 MessageList received new message:', message);
      console.log('📨 Message channel:', message.channelId, 'Current channel:', channelId);
      console.log('📨 Message user info:', message.user);
      if (message.channelId === channelId) {
        setMessages((prev: Message[]) => {
          // Avoid duplicates by checking if message already exists
          const exists = prev.some(m => m.id === message.id);
          if (exists) {
            console.log('⚠️ Duplicate message detected, skipping:', message.id);
            return prev;
          }
          console.log('✅ Adding new message to list:', message.id);
          console.log('📋 Current messages before adding:', prev.length);
          
          // Add message to the end (most recent)
          const newMessages = [...prev, message];
          console.log('📋 Total messages after adding:', newMessages.length);
          
          // Sort by creation time to ensure proper order
          const sortedMessages = newMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          console.log('📋 Final sorted messages:', sortedMessages.length);
          return sortedMessages;
        });
        // Scroll to bottom after a short delay to ensure DOM update
        setTimeout(() => {
          console.log('📜 Scrolling to bottom after new message');
          scrollToBottom();
        }, 100);
      } else {
        console.log('📨 Message not for current channel, ignoring');
      }
    }, [channelId, scrollToBottom]),
    onMessageUpdated: useCallback((message: Message) => {
      if (message.channelId === channelId) {
        setMessages((prev: Message[]) =>
          prev.map((msg: Message) => msg.id === message.id ? message : msg)
        );
      }
    }, [channelId]),
    onMessageDeleted: useCallback((messageId: string) => {
      setMessages((prev: Message[]) => prev.filter((msg: Message) => msg.id !== messageId));
    }, []),
  });

  // Load messages when channel changes
  useEffect(() => {
    if (channelId) {
      console.log('📋 MessageList: Loading messages for channel:', channelId);
      
      // Reset pagination state
      setPage(1);
      setHasMore(true);
      
      // Join the channel for real-time updates first
      console.log('🔗 MessageList: Joining channel:', channelId);
      joinChannel(channelId);
      
      // Clear messages and fetch new ones
      setMessages([]);
      fetchMessages(channelId, 1, 50);
      
      // Leave the channel when component unmounts or channel changes
      return () => {
        console.log('🚪 MessageList: Leaving channel:', channelId);
        leaveChannel(channelId);
      };
    }
  }, [channelId, fetchMessages, joinChannel, leaveChannel]);

  // Update messages when data changes
  useEffect(() => {
    if (messagesData) {
      const messages = Array.isArray(messagesData) ? messagesData : messagesData.messages || [];
      if (page === 1) {
        console.log('📋 Setting initial messages from API:', messages.length);
        setMessages(messages);
        // Scroll to bottom for initial load
        setTimeout(scrollToBottom, 100);
      } else {
        console.log('📋 Adding more messages from API:', messages.length);
        setMessages(prev => [...messages, ...prev]);
      }
      setHasMore(messages.length === 50);
    }
  }, [messagesData, page, scrollToBottom]);

  const loadMoreMessages = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMessages(channelId, nextPage, 50);
    }
  }, [channelId, page, loading, hasMore, fetchMessages]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container && container.scrollTop === 0 && hasMore && !loading) {
      loadMoreMessages();
    }
  }, [hasMore, loading, loadMoreMessages]);

  const handleEditMessage = useCallback(async (messageId: string, content: string) => {
    try {
      const response = await apiService.editMessage(messageId, content);
      if (response.success && response.data) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === messageId
              ? { ...msg, content, editedAt: new Date() }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  }, []);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      const response = await apiService.deleteMessage(messageId);
      if (response.success) {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  }, []);

  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      // For now, just add reaction - will implement proper toggle later
      await apiService.addReaction(messageId, emoji);
      
      // Update local state optimistically
      setMessages(prev =>
        prev.map(msg => {
          if (msg.id === messageId) {
            const reactions = msg.reactions || [];
            const existingReaction = reactions.find(r => r.emoji === emoji);
            
            if (existingReaction) {
              return {
                ...msg,
                reactions: reactions.map(r =>
                  r.emoji === emoji
                    ? { ...r, count: (r.count || 0) + 1 }
                    : r
                )
              };
            } else {
              return {
                ...msg,
                reactions: [...reactions, { 
                  id: `${messageId}-${emoji}`,
                  messageId,
                  userId: user?.id || '',
                  emoji, 
                  count: 1,
                  createdAt: new Date()
                }]
              };
            }
          }
          return msg;
        })
      );
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  }, [user?.id]);

  if (!user) {
    return <div className={`flex items-center justify-center ${className}`}>認証が必要です</div>;
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {/* Load More Button */}
        {hasMore && messages.length > 0 && (
          <div className="p-4 text-center">
            <button
              onClick={loadMoreMessages}
              disabled={loading}
              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors duration-200"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  読み込み中...
                </div>
              ) : (
                '過去のメッセージを読み込む'
              )}
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                currentUser={user}
                onEdit={handleEditMessage}
                onDelete={handleDeleteMessage}
                onReaction={handleReaction}
              />
            ))}
          </div>
        ) : !loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <svg className="h-12 w-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p>まだメッセージがありません</p>
              <p className="text-sm mt-1">最初のメッセージを送信してみましょう！</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessageList;