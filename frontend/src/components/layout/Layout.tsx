import React, { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="h-screen bg-secondary-50 overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    <div className="h-screen bg-secondary-50 overflow-hidden">
      {children}
    </div>
  );
};

export default Layout;