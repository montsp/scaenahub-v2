import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  PrinterIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

const NavigationMenu: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isScriptMenuOpen, setIsScriptMenuOpen] = useState(false);

  const isActivePage = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handlePrintScript = () => {
    if (location.pathname.startsWith('/scripts/')) {
      window.print();
    } else {
      navigate('/scripts');
    }
  };

  const mainNavItems = [
    {
      name: 'チャット',
      path: '/channels',
      icon: ChatBubbleLeftRightIcon,
      active: isActivePage('/channels'),
      description: 'チャット・コミュニケーション'
    },
    {
      name: 'メンバー',
      path: '/members',
      icon: UserGroupIcon,
      active: isActivePage('/members'),
      description: 'メンバー管理'
    },
    {
      name: '設定',
      path: '/settings',
      icon: Cog6ToothIcon,
      active: isActivePage('/settings'),
      description: 'システム設定'
    }
  ];

  const scriptMenuItems = [
    {
      name: '脚本一覧',
      path: '/scripts',
      description: '脚本の閲覧・編集'
    },
    {
      name: '印刷プレビュー',
      action: handlePrintScript,
      description: '脚本の印刷'
    }
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">ScaenaHub v2</h1>
            <p className="text-xs text-gray-500">Theater Project Hub</p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-2">
          {/* Main Menu Items */}
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors duration-200 ${
                  item.active
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-gray-500 truncate">{item.description}</div>
                </div>
              </button>
            );
          })}

          {/* Script Menu */}
          <div className="pt-2">
            <button
              onClick={() => setIsScriptMenuOpen(!isScriptMenuOpen)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors duration-200 ${
                isActivePage('/scripts')
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <DocumentTextIcon className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">脚本管理</div>
                <div className="text-xs text-gray-500">脚本の閲覧・編集・印刷</div>
              </div>
              {isScriptMenuOpen ? (
                <ChevronDownIcon className="h-4 w-4 flex-shrink-0" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 flex-shrink-0" />
              )}
            </button>

            {/* Script Submenu */}
            {isScriptMenuOpen && (
              <div className="ml-8 mt-2 space-y-1">
                {scriptMenuItems.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => item.action ? item.action() : handleNavigation(item.path!)}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left text-sm transition-colors duration-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  >
                    {item.path === '/scripts' ? (
                      <DocumentTextIcon className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <PrinterIcon className="h-4 w-4 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-gray-400">{item.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            クイックアクション
          </div>
          <div className="space-y-2">
            <button
              onClick={() => handleNavigation('/channels')}
              className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md transition-colors duration-200"
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
              <span>チャットに戻る</span>
            </button>
            <button
              onClick={() => handleNavigation('/scripts')}
              className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md transition-colors duration-200"
            >
              <DocumentTextIcon className="h-4 w-4" />
              <span>脚本を開く</span>
            </button>
          </div>
        </div>
      </div>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {(user?.profile?.displayName || user?.username || 'U').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {user?.profile?.displayName || user?.username}
            </div>
            <div className="text-xs text-gray-500">
              {user?.roles?.includes('admin') ? '管理者' : 'メンバー'}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors duration-200"
        >
          <ArrowRightOnRectangleIcon className="h-4 w-4" />
          <span>ログアウト</span>
        </button>
      </div>
    </div>
  );
};

export default NavigationMenu;