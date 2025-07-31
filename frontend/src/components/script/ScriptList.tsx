import React, { useState, useEffect } from 'react';
import { Script } from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../hooks/useApi';

interface ScriptListProps {
  selectedScriptId?: string;
  onScriptSelect: (script: Script) => void;
  className?: string;
}

const ScriptList: React.FC<ScriptListProps> = ({
  selectedScriptId,
  onScriptSelect,
  className = '',
}) => {
  const { user } = useAuth();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newScriptTitle, setNewScriptTitle] = useState('');

  const {
    data: scriptsData,
    loading: scriptsLoading,
    error: scriptsError,
    execute: fetchScripts,
  } = useApi(apiService.getScripts);

  const {
    execute: createScript,
    loading: createLoading,
  } = useApi(apiService.createScript);

  // Load scripts
  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  // Update local state when data changes
  useEffect(() => {
    if (scriptsData) {
      const scriptsArray = Array.isArray(scriptsData) 
        ? scriptsData 
        : scriptsData.scripts || [];
      console.log('📜 ScriptList: Setting scripts:', scriptsArray.length);
      setScripts(scriptsArray);
    }
  }, [scriptsData]);

  const handleCreateScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScriptTitle.trim()) return;

    try {
      const newScript = await createScript({
        title: newScriptTitle.trim(),
        description: '',
        version: 1,
        isActive: true,
        createdBy: user?.id || '',
      });

      if (newScript) {
        setScripts(prev => Array.isArray(prev) ? [...prev, newScript] : [newScript]);
        setNewScriptTitle('');
        setIsCreating(false);
        onScriptSelect(newScript);
      }
    } catch (error) {
      console.error('Failed to create script:', error);
    }
  };

  const canCreateScripts = user?.roles?.includes('admin') || user?.roles?.includes('moderator');

  const loading = scriptsLoading;
  const error = scriptsError;

  if (loading && scripts.length === 0) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full script-list ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">脚本一覧</h2>
        {canCreateScripts && (
          <button
            onClick={() => setIsCreating(true)}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors duration-200"
            title="新しい脚本を作成"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        )}
      </div>

      {/* Script Creation Form */}
      {isCreating && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <form onSubmit={handleCreateScript} className="space-y-2">
            <input
              type="text"
              value={newScriptTitle}
              onChange={(e) => setNewScriptTitle(e.target.value)}
              placeholder="脚本タイトルを入力"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
              disabled={createLoading}
            />
            <div className="flex space-x-2">
              <button
                type="submit"
                disabled={createLoading || !newScriptTitle.trim()}
                className="flex-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {createLoading ? '作成中...' : '作成'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewScriptTitle('');
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

      {/* Script List */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {Array.isArray(scripts) && scripts.map((script) => (
            <button
              key={script.id}
              onClick={() => onScriptSelect(script)}
              className={`w-full p-4 rounded-lg text-left transition-colors duration-200 ${
                selectedScriptId === script.id
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'hover:bg-gray-100 text-gray-700 border border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{script.title}</h3>
                  {script.description && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {script.description}
                    </p>
                  )}
                  <div className="flex items-center space-x-2 mt-2 text-xs text-gray-500">
                    <span>v{script.version}</span>
                    {script.isActive && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">
                        アクティブ
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-2 flex-shrink-0">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </button>
          ))}

          {(!Array.isArray(scripts) || scripts.length === 0) && !loading && (
            <div className="text-center py-8 text-gray-500">
              <svg className="h-12 w-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">脚本がありません</p>
              {canCreateScripts && (
                <button
                  onClick={() => setIsCreating(true)}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 transition-colors duration-200"
                >
                  最初の脚本を作成
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* User Info Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          脚本管理システム - ScaenaHub v2
        </div>
      </div>
    </div>
  );
};

export default ScriptList;