import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Script } from '../types';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ScriptViewer from '../components/script/ScriptViewer';
import ScriptList from '../components/script/ScriptList';

const ScriptPage: React.FC = () => {
  const { scriptId } = useParams<{ scriptId?: string }>();
  const { user } = useAuth();
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
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

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden script-page">
      {/* Script List Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        <ScriptList
          selectedScriptId={selectedScript?.id}
          onScriptSelect={handleScriptSelect}
          className="h-full"
        />
      </div>

      {/* Main Script Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedScript ? (
          <ScriptViewer
            script={selectedScript}
            user={user}
            className="h-full"
          />
        ) : (
          /* Welcome Screen */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200">
                <div className="mb-6">
                  <svg className="h-16 w-16 mx-auto text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                
                <h4 className="text-xl font-semibold text-gray-800 mb-3">
                  脚本ビューへようこそ！
                </h4>
                
                <p className="text-gray-600 mb-6">
                  演劇プロジェクトの脚本を閲覧・編集できます。
                  左側のサイドバーから脚本を選択してください。
                </p>

                <div className="space-y-2 text-sm text-gray-500">
                  <p>📝 脚本の閲覧・編集が可能です</p>
                  <p>🎭 登場人物、台詞、照明、音響を管理</p>
                  <p>👥 リアルタイムでの共同編集</p>
                  <p>📱 iPad・PC・スマホ対応</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-400">
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
      </div>
    </div>
  );
};

export default ScriptPage;