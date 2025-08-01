import React, { useState, useEffect, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    ChatBubbleLeftRightIcon,
    DocumentTextIcon,
    UserGroupIcon,
    Cog6ToothIcon,
    Bars3Icon,
    XMarkIcon,
    ArrowRightOnRectangleIcon,
    ArrowLeftIcon,
} from '@heroicons/react/24/outline';

interface UnifiedLayoutProps {
    children: ReactNode;
    showSidebar?: boolean;
    sidebarContent?: ReactNode;
    defaultSidebarOpen?: boolean;
    showBackButton?: boolean;
    onBackClick?: () => void;
    autoCloseSidebarOnSelect?: boolean;
}

const UnifiedLayout: React.FC<UnifiedLayoutProps> = ({
    children,
    showSidebar = false,
    sidebarContent,
    defaultSidebarOpen = false,
    showBackButton = false,
    onBackClick,
    autoCloseSidebarOnSelect = false
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(defaultSidebarOpen);

    // Update sidebar state when defaultSidebarOpen changes
    useEffect(() => {
        console.log('Setting sidebar open to:', defaultSidebarOpen);
        setIsSidebarOpen(defaultSidebarOpen);
    }, [defaultSidebarOpen]);

    // Close mobile menu on route change, but don't automatically close sidebar
    useEffect(() => {
        setIsMobileMenuOpen(false);
        // Don't automatically close sidebar on route change - let defaultSidebarOpen handle it
    }, [location.pathname]);

    // Listen for sidebar close/open events
    useEffect(() => {
        const handleCloseSidebar = () => {
            if (window.innerWidth >= 1024 && autoCloseSidebarOnSelect) {
                setIsSidebarOpen(false);
            }
        };

        const handleOpenSidebar = () => {
            if (window.innerWidth >= 1024) {
                setIsSidebarOpen(true);
            }
        };

        window.addEventListener('closeSidebar', handleCloseSidebar);
        window.addEventListener('openSidebar', handleOpenSidebar);
        
        return () => {
            window.removeEventListener('closeSidebar', handleCloseSidebar);
            window.removeEventListener('openSidebar', handleOpenSidebar);
        };
    }, [autoCloseSidebarOnSelect]);

    // Handle viewport height changes for mobile keyboards
    useEffect(() => {
        const handleResize = () => {
            // Update CSS custom property for viewport height
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
        };
    }, []);

    const isActivePage = (path: string) => {
        return location.pathname.startsWith(path);
    };

    const handleNavigation = (path: string) => {
        navigate(path);
        setIsMobileMenuOpen(false);
        
        // Don't automatically control sidebar here - let the page components handle it
        // The defaultSidebarOpen prop will handle the initial state
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
            name: '脚本管理',
            path: '/scripts',
            icon: DocumentTextIcon,
            active: isActivePage('/scripts'),
            description: '脚本の閲覧・編集・印刷'
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

    return (
        <div className="h-screen bg-gray-50 overflow-hidden flex" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Main Navigation Sidebar */}
            <div className={`
        fixed lg:relative inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 
        transform transition-transform duration-300 ease-in-out lg:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">S</span>
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-gray-900">ScaenaHub v2</h1>
                            <p className="text-xs text-gray-500">Theater Project Hub</p>
                        </div>
                    </div>

                    {/* Close button for mobile */}
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="lg:hidden p-1 text-gray-500 hover:text-gray-700"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation Items */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-2">
                        {mainNavItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.path}
                                    onClick={() => handleNavigation(item.path)}
                                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-200 ${item.active
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    <Icon className="h-5 w-5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm">{item.name}</div>
                                        <div className="text-xs text-gray-500 truncate">{item.description}</div>
                                    </div>
                                </button>
                            );
                        })}
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

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden lg:ml-0">
                {/* Top Header with Hamburger */}
                <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center space-x-3">
                        {/* Back button (mobile only) */}
                        {showBackButton && onBackClick && (
                            <button
                                onClick={onBackClick}
                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200 lg:hidden"
                                title="戻る"
                            >
                                <ArrowLeftIcon className="h-5 w-5" />
                            </button>
                        )}

                        {/* Hamburger button */}
                        <button
                            onClick={() => {
                                // Mobile: toggle main navigation menu
                                // Desktop with sidebar: toggle page-specific sidebar
                                // Desktop without sidebar: toggle main navigation menu
                                if (window.innerWidth < 1024) {
                                    setIsMobileMenuOpen(!isMobileMenuOpen);
                                } else if (showSidebar) {
                                    setIsSidebarOpen(!isSidebarOpen);
                                } else {
                                    setIsMobileMenuOpen(!isMobileMenuOpen);
                                }
                            }}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                            title="メニュー"
                        >
                            <Bars3Icon className="h-5 w-5" />
                        </button>

                        {/* Page Title */}
                        <h2 className="text-lg font-semibold text-gray-800">
                            {isActivePage('/channels') && 'チャット'}
                            {isActivePage('/scripts') && '脚本管理'}
                            {isActivePage('/members') && 'メンバー管理'}
                            {isActivePage('/settings') && '設定'}
                        </h2>
                    </div>

                    {/* Connection Status */}
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-xs text-gray-500 hidden sm:inline">接続中</span>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* Page-specific Sidebar */}
                    {showSidebar && sidebarContent && (
                        <div className={`
              ${isSidebarOpen ? 'w-80' : 'w-0'} 
              bg-white border-r border-gray-200 flex flex-col overflow-hidden 
              transition-all duration-300 ease-in-out
              ${isSidebarOpen ? 'block' : 'hidden lg:block'}
            `}>
                            {sidebarContent}
                        </div>
                    )}

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UnifiedLayout;