import React, { useState } from 'react';
import { Channel } from '../types';
import { useAuth } from '../contexts/AuthContext';
import UnifiedLayout from '../components/layout/UnifiedLayout';
import ChannelList from '../components/chat/ChannelList';
import MessageList from '../components/chat/MessageList';
import MessageInput from '../components/chat/MessageInput';

const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  
  // Debug logging
  console.log('ChatPage render - selectedChannel:', selectedChannel?.name || 'none');

  const handleChannelSelect = (channel: Channel) => {
    if (selectedChannel?.id !== channel.id) {
      setSelectedChannel(channel);
    }
  };

  const handleBackClick = () => {
    setSelectedChannel(null);
  };

  const handleMessageSent = (response: any) => {
    console.log('📤 Message sent successfully:', response);
  };

  // Channel List Sidebar Content
  const sidebarContent = (
    <ChannelList
      selectedChannelId={selectedChannel?.id}
      onChannelSelect={handleChannelSelect}
      className="h-full"
    />
  );

  return (
    <UnifiedLayout 
      showSidebar={true} 
      sidebarContent={sidebarContent}
      defaultSidebarOpen={!selectedChannel} // Open when no channel selected, closed when channel selected
      showBackButton={!!selectedChannel}
      onBackClick={handleBackClick}
      autoCloseSidebarOnSelect={false} // Don't auto-close
      key={selectedChannel ? `channel-${selectedChannel.id}` : 'channel-list'} // Force re-render on state change
    >
      {/* Main Chat Content */}
      {selectedChannel ? (
        <div className="flex flex-col h-full">
          {/* Channel Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center space-x-3 flex-shrink-0">
            {/* Channel info */}
            <div className="flex items-center space-x-2">
              {selectedChannel.isPrivate ? (
                <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) : (
                <span className="text-gray-500 font-medium">#</span>
              )}
              <h3 className="text-lg font-semibold text-gray-800 truncate">
                {selectedChannel.name}
              </h3>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <MessageList
              key={selectedChannel.id}
              channelId={selectedChannel.id}
              className="h-full"
            />
          </div>

          {/* Message Input */}
          <div className="flex-shrink-0 border-t border-gray-200">
            <MessageInput
              channelId={selectedChannel.id}
              onMessageSent={handleMessageSent}
            />
          </div>
        </div>
      ) : (
        /* Channel List View - Show sidebar content as main content on mobile */
        <div className="flex-1 lg:hidden">
          {sidebarContent}
        </div>
      )}
    </UnifiedLayout>
  );
};

export default ChatPage;