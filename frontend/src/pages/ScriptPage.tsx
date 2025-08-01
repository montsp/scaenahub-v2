import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Script } from '../types';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import UnifiedLayout from '../components/layout/UnifiedLayout';
import ScriptViewer from '../components/script/ScriptViewer';
import ScriptList from '../components/script/ScriptList';

const ScriptPage: React.FC = () => {
  const { scriptId } = useParams<{ scriptId?: string }>();
  const { user } = useAuth();
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  
  // Debug logging
  console.log('ScriptPage render - selectedScript:', selectedScript?.title || 'none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load script if scriptId is provided
  useEffect(() => {
    if (scriptId) {
      loadScript(scriptId);
    }
  }, [scriptId]);

  const loadScript = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getScript(id);
      if (response.success && response.data) {
        setSelectedScript(response.data);
      } else {
        setError('脚本の読み込みに失敗しました');
      }
    } catch (error) {
      console.error('Failed to load script:', error);
      setError('脚本の読み込み中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleScriptSelect = (script: Script) => {
    setSelectedScript(script);
  };

  const handleBackClick = () => {
    setSelectedScript(null);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Script List Sidebar Content
  const sidebarContent = (
    <ScriptList
      selectedScriptId={selectedScript?.id}
      onScriptSelect={handleScriptSelect}
      className="h-full"
    />
  );

  return (
    <UnifiedLayout 
      showSidebar={true} 
      sidebarContent={sidebarContent}
      defaultSidebarOpen={!selectedScript} // Open when no script selected, closed when script selected
      showBackButton={!!selectedScript}
      onBackClick={handleBackClick}
      autoCloseSidebarOnSelect={false} // Don't auto-close
      key={selectedScript ? `script-${selectedScript.id}` : 'script-list'} // Force re-render on state change
    >
      {/* Main Script Content */}
      {selectedScript ? (
        <ScriptViewer
          script={selectedScript}
          user={user}
          className="h-full"
        />
      ) : (
        /* Script List View - Show sidebar content as main content on mobile */
        <div className="flex-1 lg:hidden">
          {sidebarContent}
        </div>
      )}

      {error && (
        <div className="absolute bottom-4 right-4 p-4 bg-red-50 border border-red-200 rounded-lg shadow-lg max-w-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
    </UnifiedLayout>
  );
};

export default ScriptPage;