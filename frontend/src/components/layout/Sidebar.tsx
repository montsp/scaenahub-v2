import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  HashtagIcon,
  SpeakerWaveIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';
import { Channel, ChannelCategory } from '../../types';
import { apiService } from '../../services/api';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadChannelsAndCategories();
  }, []);

  const loadChannelsAndCategories = async () => {
    try {
      setIsLoading(true);
      const [channelsResponse, categoriesResponse] = await Promise.all([
        apiService.getChannels(),
        apiService.getChannelCategories()
      ]);

      if (channelsResponse.success && channelsResponse.data) {
        setChannels(channelsResponse.data);
      }

      if (categoriesResponse.success && categoriesResponse.data) {
        setCategories(categoriesResponse.data);
      }
    } catch (error) {
      console.error('Failed to load channels and categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(categoryId)) {
      newCollapsed.delete(categoryId);
    } else {
      newCollapsed.add(categoryId);
    }
    setCollapsedCategories(newCollapsed);
  };

  const getChannelIcon = (channel: Channel) => {
    if (channel.isPrivate) {
      return <LockClosedIcon className="channel-icon" />;
    }
    
    switch (channel.type) {
      case 'announcement':
        return <SpeakerWaveIcon className="channel-icon" />;
      case 'discussion':
        return <ChatBubbleLeftRightIcon className="channel-icon" />;
      default:
        return <HashtagIcon className="channel-icon" />;
    }
  };

  const isActiveChannel = (channelId: string) => {
    return location.pathname === `/channels/${channelId}`;
  };

  const isActivePage = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const navigationItems = [
    {
      name: 'Channels',
      path: '/channels',
      icon: ChatBubbleLeftRightIcon,
      active: isActivePage('/channels')
    },
    {
      name: 'Scripts',
      path: '/scripts',
      icon: DocumentTextIcon,
      active: isActivePage('/scripts')
    },
    {
      name: 'Members',
      path: '/members',
      icon: UserGroupIcon,
      active: isActivePage('/members')
    },
    {
      name: 'Settings',
      path: '/settings',
      icon: Cog6ToothIcon,
      active: isActivePage('/settings')
    }
  ];

  const groupChannelsByCategory = () => {
    const grouped: { [key: string]: Channel[] } = {};
    const uncategorized: Channel[] = [];

    channels.forEach(channel => {
      if (channel.categoryId) {
        if (!grouped[channel.categoryId]) {
          grouped[channel.categoryId] = [];
        }
        grouped[channel.categoryId].push(channel);
      } else {
        uncategorized.push(channel);
      }
    });

    return { grouped, uncategorized };
  };

  const { grouped, uncategorized } = groupChannelsByCategory();

  return (
    <div className="sidebar">
      {/* Server header */}
      <div className="sidebar-header">
        <h1 className="text-lg font-bold text-gray-900">
          ScaenaHub v2
        </h1>
        <p className="text-sm text-gray-500 mt-1">Theater Project Hub</p>
      </div>

      {/* Navigation */}
      <div className="sidebar-nav">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.path}
              href={item.path}
              onClick={(e) => {
                e.preventDefault();
                navigate(item.path);
              }}
              className={`sidebar-nav-item ${item.active ? 'active' : ''}`}
            >
              <Icon className="sidebar-nav-icon" />
              <span>{item.name}</span>
            </a>
          );
        })}
      </div>

      {/* Channels section */}
      <div className="channel-list">
        <div className="flex items-center justify-between px-5 mb-2">
          <h3 className="channel-category-header">
            Channels
          </h3>
          <button className="btn btn-outline btn-sm">
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="px-5 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div>
            {/* Uncategorized channels */}
            {uncategorized.map((channel) => (
              <a
                key={channel.id}
                href={`/channels/${channel.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/channels/${channel.id}`);
                }}
                className={`channel-item ${isActiveChannel(channel.id) ? 'active' : ''}`}
              >
                {getChannelIcon(channel)}
                <span className="truncate">{channel.name}</span>
              </a>
            ))}

            {/* Categorized channels */}
            {categories.map((category) => {
              const categoryChannels = grouped[category.id] || [];
              const isCollapsed = collapsedCategories.has(category.id);

              return (
                <div key={category.id} className="channel-category">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="channel-category-header w-full text-left"
                  >
                    {isCollapsed ? (
                      <ChevronRightIcon className="h-3 w-3 mr-1" />
                    ) : (
                      <ChevronDownIcon className="h-3 w-3 mr-1" />
                    )}
                    {category.name}
                  </button>

                  {!isCollapsed && (
                    <div className="ml-4">
                      {categoryChannels.map((channel) => (
                        <a
                          key={channel.id}
                          href={`/channels/${channel.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(`/channels/${channel.id}`);
                          }}
                          className={`channel-item ${isActiveChannel(channel.id) ? 'active' : ''}`}
                        >
                          {getChannelIcon(channel)}
                          <span className="truncate">{channel.name}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;