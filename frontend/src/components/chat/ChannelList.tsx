import React, { useState, useEffect } from 'react';
import { Channel, ChannelCategory } from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../hooks/useApi';

interface ChannelListProps {
  selectedChannelId?: string;
  onChannelSelect: (channel: Channel) => void;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
  className?: string;
}

const ChannelList: React.FC<ChannelListProps> = ({
  selectedChannelId,
  onChannelSelect,
  onToggleSidebar,
  sidebarCollapsed = false,
  className = '',
}) => {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  // API hooks
  const {
    data: channelsData,
    loading: channelsLoading,
    error: channelsError,
    execute: fetchChannels,
  } = useApi(apiService.getChannels);

  const {
    data: categoriesData,
    loading: categoriesLoading,
    error: categoriesError,
    execute: fetchCategories,
  } = useApi(apiService.getChannelCategories);

  const {
    execute: createChannel,
    loading: createLoading,
  } = useApi(apiService.createChannel);

  // Load channels and categories
  useEffect(() => {
    fetchChannels();
    fetchCategories();
  }, [fetchChannels, fetchCategories]);

  // Update local state when data changes
  useEffect(() => {
    if (channelsData) {
      const channelsArray = Array.isArray(channelsData) 
        ? channelsData 
        : channelsData.channels || [];
      console.log('📺 ChannelList: Setting channels:', channelsArray.length);
      setChannels(channelsArray);
    }
  }, [channelsData]);

  useEffect(() => {
    if (categoriesData) {
      const categoriesArray = Array.isArray(categoriesData) 
        ? categoriesData 
        : categoriesData.categories || [];
      console.log('📂 ChannelList: Setting categories:', categoriesArray.length);
      setCategories(categoriesArray);
    }
  }, [categoriesData]);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    try {
      const newChannel = await createChannel({
        name: newChannelName.trim(),
        type: 'text',
        description: '',
        isPrivate: false,
        position: channels.length,
        createdBy: user?.id || '',
      });

      if (newChannel) {
        setChannels(prev => Array.isArray(prev) ? [...prev, newChannel] : [newChannel]);
        setNewChannelName('');
        setIsCreating(false);
        onChannelSelect(newChannel);
      }
    } catch (error) {
      console.error('Failed to create channel:', error);
    }
  };

  const getChannelIcon = (channel: Channel) => {
    if (channel.isPrivate) {
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      );
    }

    switch (channel.type) {
      case 'announcement':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        );
      case 'discussion':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-6a2 2 0 012-2h8z" />
          </svg>
        );
      default:
        return <span className="text-gray-500">#</span>;
    }
  };

  const canCreateChannels = user?.roles?.includes('admin') || user?.roles?.includes('moderator');

  if (sidebarCollapsed) {
    return null;
  }

  const loading = channelsLoading || categoriesLoading;
  const error = channelsError || categoriesError;

  if (loading && channels.length === 0) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">チャンネル</h3>
        {canCreateChannels && (
          <button
            onClick={() => setIsCreating(true)}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200"
            title="新しいチャンネルを作成"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        )}
      </div>

      {/* Channel Creation Form */}
      {isCreating && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <form onSubmit={handleCreateChannel} className="space-y-2">
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="チャンネル名を入力"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
              disabled={createLoading}
            />
            <div className="flex space-x-2">
              <button
                type="submit"
                disabled={createLoading || !newChannelName.trim()}
                className="flex-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {createLoading ? '作成中...' : '作成'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewChannelName('');
                }}
                className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                disabled={createLoading}
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-1">
          {Array.isArray(channels) && channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => onChannelSelect(channel)}
              className={`w-full p-3 rounded-lg text-left transition-colors duration-200 ${
                selectedChannelId === channel.id
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                {getChannelIcon(channel)}
                <span className="font-medium truncate">{channel.name}</span>
              </div>
              {channel.description && (
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {channel.description}
                </p>
              )}
            </button>
          ))}

          {(!Array.isArray(channels) || channels.length === 0) && !loading && (
            <div className="text-center py-8 text-gray-500">
              <svg className="h-12 w-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm">チャンネルがありません</p>
              {canCreateChannels && (
                <button
                  onClick={() => setIsCreating(true)}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 transition-colors duration-200"
                >
                  最初のチャンネルを作成
                </button>
              )}
            </div>
          )}
        </div>
      </div>


    </div>
  );
};

export default ChannelList;