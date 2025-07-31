import React, { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import NavigationMenu from './NavigationMenu';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="h-screen bg-gray-50 overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 overflow-hidden flex">
      {/* Navigation Menu */}
      <NavigationMenu />
      
      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
};

export default Layout;