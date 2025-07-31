import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Bars3Icon, 
  MagnifyingGlassIcon, 
  BellIcon, 
  UserCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className="header">
      {/* Mobile menu button */}
      <button className="lg:hidden btn btn-outline btn-sm">
        <Bars3Icon className="h-4 w-4" />
      </button>
      
      {/* Search bar */}
      <div className="header-search">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search messages, channels, users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input pl-10"
          />
        </div>
      </div>

      {/* Right section */}
      <div className="header-actions">
        {/* Notifications */}
        <button className="btn btn-outline btn-sm relative">
          <BellIcon className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
            3
          </span>
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="btn btn-outline btn-sm"
          >
            <UserCircleIcon className="h-4 w-4 mr-2" />
            <span className="hidden md:block">
              {user?.profile?.displayName || user?.username}
            </span>
          </button>

          {/* Profile dropdown */}
          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 card shadow-lg z-50">
              <div className="py-2">
                <div className="px-4 py-2 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.profile?.displayName || user?.username}
                  </p>
                  <p className="text-xs text-gray-500">@{user?.username}</p>
                </div>
                
                <Link
                  to="/profile"
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                  onClick={() => setIsProfileMenuOpen(false)}
                >
                  <UserCircleIcon className="h-4 w-4 mr-2" />
                  <span>Profile</span>
                </Link>
                
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                  <Cog6ToothIcon className="h-4 w-4 mr-2" />
                  <span>Settings</span>
                </button>
                
                <div className="border-t border-gray-200 mt-2 pt-2">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 flex items-center"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;