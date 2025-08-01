import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Message, User } from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { socketService } from '../../services/socket';
import MarkdownMessage from './MarkdownMessage';
import MentionInput from './MentionInput';
import ReactionPicker from './ReactionPicker';

interface ThreadViewProps {
  parentMessage: Message;
  onClose: () => void;
  className?: string;
}

interface ThreadMessageProps {
  message: Message;
  currentUser: User;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  isParent?: boolean;
}

const ThreadMessage: React.FC<ThreadMessageProps> = ({
  message,
  currentUser,
  onEdit,
  onDelete,
  onReaction,
  isParent = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showActions, setShowActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const reactionButtonRef = useRef<HTMLButtonElement>(null);

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
      className={`group p-3 hover:bg-gray-50 transition-colors duration-200 ${
        isParent ? 'border-b border-gray-200 bg-blue-50' : ''
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex space-x-3">
        {/* User Avatar */}
        <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
          {userInitial}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          {/* Message Header */}
          <div className="flex items-center space-x-2 mb-1">
            <span className="font-medium text-gray-900 text-sm">{userDisplayName}</span>
            <span className="text-xs text-gray-500">{formatTime(message.createdAt)}</span>
            {message.editedAt && (
              <span className="text-xs text-gray-400">(編集済み)</span>
            )}
            {isParent && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                元メッセージ
              </span>
            )}
          </div>

          {/* Message Body */}
          {isEditing ? (
            <div className="space-y-2">
              <MentionInput
                value={editContent}
                onChange={setEditContent}
                onKeyDown={handleKeyDown}
                placeholder="メッセージを編集..."
                className="text-sm"
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
              <MarkdownMessage content={message.content} />
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
            <div className="relative">
              <button
                ref={reactionButtonRef}
                onClick={() => setShowReactionPicker(!showReactionPicker)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                title="リアクション"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              
              {showReactionPicker && (
                <ReactionPicker
                  onEmojiSelect={(emoji) => {
                    onReaction?.(message.id, emoji);
                    setShowReactionPicker(false);
                  }}
                  onClose={() => setShowReactionPicker(false)}
                  triggerRef={reactionButtonRef}
                />
              )}
            </div>
            
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

const ThreadView: React.FC<ThreadViewProps> = ({
  parentMessage,
  onClose,
  className = '',
}) => {
  const { user } = useAuth();
  const [replies, setReplies] = useState<Message[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Socket for real-time updates
  const { joinChannel, leaveChannel } = useSocket({
    onMessage: useCallback((message: Message) => {
      if (message.parentId === parentMessage.id) {
        setReplies((prev: Message[]) => {
          const exists = prev.some(m => m.id === message.id);
          if (!exists) {
            return [...prev, message].sort((a, b) => 
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          }
          return prev;
        });
      }
    }, [parentMessage.id]),
    onMessageUpdated: useCallback((message: Message) => {
      if (message.id === parentMessage.id) {
        // Parent message updated - could update parent display
      } else if (message.parentId === parentMessage.id) {
        setReplies((prev: Message[]) =>
          prev.map((msg: Message) => msg.id === message.id ? message : msg)
        );
      }
    }, [parentMessage.id]),
    onMessageDeleted: useCallback((messageId: string) => {
      setReplies((prev: Message[]) => prev.filter((msg: Message) => msg.id !== messageId));
    }, []),

  });

  // Load thread replies
  useEffect(() => {
    const loadReplies = async () => {
      try {
        setLoading(true);
        console.log('🧵 Loading thread replies for message:', parentMessage.id);
        const response = await apiService.getThreadReplies(parentMessage.id);
        console.log('🧵 Thread replies response:', response);
        
        if (response.success && response.data) {
          const repliesData = Array.isArray(response.data) ? response.data : (response.data as any)?.replies || [];
          console.log('🧵 Thread replies data:', repliesData);
          setReplies(repliesData);
        }
      } catch (error) {
        console.error('❌ Failed to load thread replies:', error);
        // Set empty replies on error
        setReplies([]);
      } finally {
        setLoading(false);
      }
    };

    if (parentMessage.id) {
      loadReplies();
      joinChannel(parentMessage.channelId);
    }

    return () => {
      leaveChannel(parentMessage.channelId);
    };
  }, [parentMessage.id, parentMessage.channelId, joinChannel, leaveChannel]);

  const handleSendReply = async () => {
    if (!replyContent.trim() || sending || !user) return;

    try {
      setSending(true);
      
      // Socket.ioでスレッド返信を送信
      const socket = socketService.getSocket();
      if (socket && socket.connected) {
        console.log('📤 Sending thread reply via Socket.io:', replyContent.trim());
        socket.emit('send_message', {
          channelId: parentMessage.channelId,
          content: replyContent.trim(),
          parentMessageId: parentMessage.id
        });
        
        console.log('✅ Thread reply sent via Socket.io');
        setReplyContent('');
      } else {
        // Socket.ioが利用できない場合はHTTP APIを使用
        console.log('📤 Sending thread reply via HTTP API (Socket.io not available)');
        const response = await apiService.sendThreadReply(parentMessage.id, replyContent.trim());
        
        if (response.success && response.data) {
          setReplyContent('');
        }
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const handleEditMessage = useCallback(async (messageId: string, content: string) => {
    try {
      const response = await apiService.editMessage(messageId, content);
      if (response.success && response.data) {
        if (messageId === parentMessage.id) {
          // Parent message edited - could update parent display
        } else {
          setReplies(prev =>
            prev.map(msg =>
              msg.id === messageId
                ? { ...msg, content, editedAt: new Date() }
                : msg
            )
          );
        }
      }
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  }, [parentMessage.id]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      const response = await apiService.deleteMessage(messageId);
      if (response.success) {
        if (messageId === parentMessage.id) {
          // Parent message deleted - close thread
          onClose();
        } else {
          setReplies(prev => prev.filter(msg => msg.id !== messageId));
        }
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  }, [parentMessage.id, onClose]);

  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      await apiService.addReaction(messageId, emoji);
      
      // Update local state optimistically
      const updateReactions = (msg: Message) => {
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
      };

      if (messageId === parentMessage.id) {
        // Parent message reaction - could update parent display
      } else {
        setReplies(prev =>
          prev.map(msg => msg.id === messageId ? updateReactions(msg) : msg)
        );
      }
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  }, [user?.id, parentMessage.id]);

  if (!user) {
    return null;
  }

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Thread Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900">スレッド</h3>
          <span className="text-sm text-gray-500">
            {replies.length} 件の返信
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Thread Messages */}
      <div className="flex-1 overflow-y-auto">
        {/* Parent Message */}
        <ThreadMessage
          message={parentMessage}
          currentUser={user}
          onEdit={handleEditMessage}
          onDelete={handleDeleteMessage}
          onReaction={handleReaction}
          isParent={true}
        />

        {/* Replies */}
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : replies.length > 0 ? (
          <div>
            {replies.map((reply) => (
              <ThreadMessage
                key={reply.id}
                message={reply}
                currentUser={user}
                onEdit={handleEditMessage}
                onDelete={handleDeleteMessage}
                onReaction={handleReaction}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center p-8 text-gray-500">
            <div className="text-center">
              <svg className="h-8 w-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm">まだ返信がありません</p>
            </div>
          </div>
        )}
      </div>

      {/* Reply Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <MentionInput
              value={replyContent}
              onChange={setReplyContent}
              onKeyDown={handleKeyDown}
              placeholder="スレッドに返信..."
              disabled={sending}
            />
          </div>
          <button
            onClick={handleSendReply}
            disabled={!replyContent.trim() || sending}
            className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 min-w-[48px] min-h-[48px] flex items-center justify-center"
            title="返信を送信"
          >
            {sending ? (
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

export default ThreadView;