import { useEffect, useCallback } from 'react';
import { socketService } from '../services/socket';
import { Message } from '../types';

interface UseSocketOptions {
  onMessage?: (message: Message) => void;
  onMessageUpdated?: (message: Message) => void;
  onMessageDeleted?: (messageId: string) => void;
  onChannelUpdated?: (channel: any) => void;
  onChannelDeleted?: (channelId: string) => void;
  onThreadReply?: (data: { parentMessageId: string; reply: Message }) => void;
}

export const useSocket = (options: UseSocketOptions = {}) => {
  const {
    onMessage,
    onMessageUpdated,
    onMessageDeleted,
    onChannelUpdated,
    onChannelDeleted,
    onThreadReply,
  } = options;

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    // Message events
    if (onMessage) {
      socket.on('message', onMessage);
    }
    if (onMessageUpdated) {
      socket.on('message-updated', onMessageUpdated);
    }
    if (onMessageDeleted) {
      socket.on('message-deleted', onMessageDeleted);
    }

    // Channel events
    if (onChannelUpdated) {
      socket.on('channel-updated', onChannelUpdated);
    }
    if (onChannelDeleted) {
      socket.on('channel-deleted', onChannelDeleted);
    }

    // Thread events
    if (onThreadReply) {
      socket.on('thread_reply', onThreadReply);
    }

    return () => {
      if (onMessage) {
        socket.off('message', onMessage);
      }
      if (onMessageUpdated) {
        socket.off('message-updated', onMessageUpdated);
      }
      if (onMessageDeleted) {
        socket.off('message-deleted', onMessageDeleted);
      }
      if (onChannelUpdated) {
        socket.off('channel-updated', onChannelUpdated);
      }
      if (onChannelDeleted) {
        socket.off('channel-deleted', onChannelDeleted);
      }
      if (onThreadReply) {
        socket.off('thread_reply', onThreadReply);
      }
    };
  }, [onMessage, onMessageUpdated, onMessageDeleted, onChannelUpdated, onChannelDeleted, onThreadReply]);

  const joinChannel = useCallback((channelId: string) => {
    socketService.joinChannel(channelId);
  }, []);

  const leaveChannel = useCallback((channelId: string) => {
    socketService.leaveChannel(channelId);
  }, []);

  const isConnected = socketService.isSocketConnected();

  return {
    joinChannel,
    leaveChannel,
    isConnected,
  };
};