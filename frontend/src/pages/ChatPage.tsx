import React, { useState } from 'react';
import { Channel } from '../types';
import { useAuth } from '../contexts/AuthContext';
import NavigationMenu from '../components/layout/NavigationMenu';
import ChannelList from '../components/chat/ChannelList';
import MessageList from '../components/chat/MessageList';
import MessageInput from '../components/chat/MessageInput';

const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleChannelSelect = (channel: Channel) => {
    if (selectedChannel?.id !== channel.id) {
      setSelectedChannel(channel);
    }
  };

  const handleMessageSent = (response: any) => {
    console.log('📤 Message sent successfully:', response);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Responsive sidebar width
  const sidebarWidth = sidebarCollapsed ? 'w-0' : 'w-64 md:w-80';

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* Navigation Menu */}
      <NavigationMenu />
      
      {/* Channel List Sidebar */}
      <div className={`${sidebarWidth} bg-white border-r border-gray-200 flex flex-col overflow-hidden transition-all duration-300 ease-in-out`}>
        <ChannelList
          selectedChannelId={selectedChannel?.id}
          onChannelSelect={handleChannelSelect}
          onToggleSidebar={toggleSidebar}
          sidebarCollapsed={sidebarCollapsed}
          className="h-full"
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Chat Content */}
        {selectedChannel ? (
          <>
            {/* Channel Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-3">
                {/* Mobile sidebar toggle */}
                <button
                  onClick={toggleSidebar}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200 lg:hidden"
                  title={sidebarCollapsed ? 'サイドバーを表示' : 'サイドバーを非表示'}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

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

              {/* Connection status */}
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-gray-500 hidden sm:inline">
                  接続中
                </span>
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
          </>
        ) : (
          /* Welcome Screen */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200">
                <div className="mb-6">
                  <svg className="h-16 w-16 mx-auto text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                
                <h4 className="text-xl font-semibold text-gray-800 mb-3">
                  ScaenaHub v2へようこそ！
                </h4>
                
                <p className="text-gray-600 mb-6">
                  演劇プロジェクトのコミュニケーションを始めましょう。
                  左側のサイドバーからチャンネルを選択してください。
                </p>

                <div className="space-y-2 text-sm text-gray-500">
                  <p>👋 ようこそ、{user?.profile?.displayName || user?.username}さん！</p>
                  <p>💬 チャンネルでメッセージを送信できます</p>
                  <p>📎 ファイルの共有も可能です</p>
                  <p>🎭 演劇プロジェクトを成功させましょう！</p>
                </div>

                {/* Mobile sidebar toggle */}
                {sidebarCollapsed && (
                  <button
                    onClick={toggleSidebar}
                    className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    チャンネル一覧を表示
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;