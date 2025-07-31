import React, { useState, useEffect } from 'react';
import { Script, ScriptLine, User } from '../../types';
import { apiService } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { handlePrint, setupPrintEventListeners } from '../../utils/printUtils';
import ScriptTable from './ScriptTable';

interface ScriptViewerProps {
  script: Script;
  user: User | null;
  className?: string;
}

const ScriptViewer: React.FC<ScriptViewerProps> = ({
  script,
  user,
  className = '',
}) => {
  const [scriptLines, setScriptLines] = useState<ScriptLine[]>([]);
  const [currentScene, setCurrentScene] = useState('第一場面');
  const [sceneAssignee, setSceneAssignee] = useState('');
  // 編集権限があるユーザーは常に編集可能

  const {
    data: linesData,
    loading: linesLoading,
    error: linesError,
    execute: fetchScriptLines,
  } = useApi(apiService.getScriptLines);

  // Load script lines
  useEffect(() => {
    if (script.id) {
      fetchScriptLines(script.id);
    }
  }, [script.id, fetchScriptLines]);

  // Setup print event listeners
  useEffect(() => {
    setupPrintEventListeners();
  }, []);

  // Update local state when data changes
  useEffect(() => {
    if (linesData) {
      const linesArray = Array.isArray(linesData) 
        ? linesData 
        : linesData.lines || [];
      console.log('📜 ScriptViewer: Setting script lines:', linesArray.length);
      setScriptLines(linesArray);
    }
  }, [linesData]);

  const canEdit = user?.roles?.includes('admin') || 
                  user?.roles?.includes('moderator') ||
                  script.createdBy === user?.id;

  const handleLineUpdate = async (lineId: string, updates: Partial<ScriptLine>) => {
    // 即座にローカル状態を更新（UX向上）
    setScriptLines(prev => 
      prev.map(line => 
        line.id === lineId ? { ...line, ...updates } : line
      )
    );

    // バックグラウンドでAPIを呼び出し
    try {
      const line = scriptLines.find(l => l.id === lineId);
      if (!line) return;
      
      const response = await apiService.updateScriptLine(script.id, line.lineNumber, updates);
      if (!response.success) {
        // API呼び出しが失敗した場合、元の状態に戻す
        console.error('Failed to update script line:', response.message);
        setScriptLines(prev => 
          prev.map(prevLine => 
            prevLine.id === lineId ? { ...prevLine, ...Object.fromEntries(Object.keys(updates).map(key => [key, line[key as keyof ScriptLine]])) } : prevLine
          )
        );
      }
    } catch (error: any) {
      console.error('Failed to update script line:', error);
      
      // エラーメッセージを表示
      const errorMessage = error.response?.data?.message || error.message || '行の更新に失敗しました';
      console.warn(`更新エラー: ${errorMessage}`);
      
      // エラーの場合も元の状態に戻す
      const originalLine = scriptLines.find(l => l.id === lineId);
      if (originalLine) {
        setScriptLines(prev => 
          prev.map(prevLine => 
            prevLine.id === lineId ? originalLine : prevLine
          )
        );
      }
    }
  };

  const handleAddLine = async () => {
    try {
      const newLineNumber = scriptLines.length + 1;
      const response = await apiService.createScriptLine(script.id, {
        lineNumber: newLineNumber,
        characterName: '',
        dialogue: '',
        lighting: '',
        audioVideo: '',
        notes: '',
      });
      
      if (response.success && response.data) {
        setScriptLines(prev => [...prev, response.data as ScriptLine]);
      }
    } catch (error: any) {
      console.error('Failed to add script line:', error);
      
      // エラーメッセージを表示
      const errorMessage = error.response?.data?.message || error.message || '行の追加に失敗しました';
      alert(`エラー: ${errorMessage}`);
    }
  };

  const handleInsertLine = async (afterLineNumber: number) => {
    try {
      // より安全なアプローチ：まず新しい行を最後に追加
      const newLineNumber = scriptLines.length + 1;
      const response = await apiService.createScriptLine(script.id, {
        lineNumber: newLineNumber,
        characterName: '',
        dialogue: '',
        lighting: '',
        audioVideo: '',
        notes: '',
      });
      
      if (response.success && response.data) {
        const newLine = response.data as ScriptLine;
        
        // 挿入位置以降の行の行番号を1つずつ増やす（後ろから順番に）
        const linesToUpdate = scriptLines
          .filter(line => line.lineNumber > afterLineNumber)
          .sort((a, b) => b.lineNumber - a.lineNumber);
        
        for (const line of linesToUpdate) {
          await apiService.updateScriptLine(script.id, line.lineNumber, { 
            lineNumber: line.lineNumber + 1 
          });
        }
        
        // 新しい行を正しい位置に移動
        const correctLineNumber = afterLineNumber + 1;
        await apiService.updateScriptLine(script.id, newLineNumber, { 
          lineNumber: correctLineNumber 
        });
        
        // ローカル状態を更新
        const updatedLines = scriptLines.map(line => 
          line.lineNumber > afterLineNumber 
            ? { ...line, lineNumber: line.lineNumber + 1 }
            : line
        );
        
        const finalNewLine = { ...newLine, lineNumber: correctLineNumber };
        const allLines = [...updatedLines, finalNewLine].sort((a, b) => a.lineNumber - b.lineNumber);
        setScriptLines(allLines);
      }
    } catch (error: any) {
      console.error('Failed to insert script line:', error);
      
      // エラーメッセージを表示
      const errorMessage = error.response?.data?.message || error.message || '行の挿入に失敗しました';
      alert(`エラー: ${errorMessage}`);
      
      // エラーが発生した場合、データを再取得
      fetchScriptLines(script.id);
    }
  };

  if (linesLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-white script-viewer ${className}`}>
      {/* Print Header (印刷時のみ表示) */}
      <div className="script-header print-only" style={{ display: 'none' }}>
        <div className="script-title">{script.title}</div>
        <div className="script-info">
          <div>{currentScene} {sceneAssignee && `（担当：${sceneAssignee}）`}</div>
        </div>
      </div>

      {/* Script Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50 no-print">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{script.title}</h1>
              {script.description && (
                <p className="text-sm text-gray-600 mt-1">{script.description}</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrint}
                className="px-3 py-1 text-sm bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors duration-200 print-button"
                title="印刷"
              >
                印刷
              </button>
              {canEdit && (
                <div className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg">
                  編集可能
                </div>
              )}
            </div>
          </div>

          {/* Scene Header */}
          <div className="flex items-center space-x-4 scene-header">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">場面:</label>
              {canEdit ? (
                <input
                  type="text"
                  value={currentScene}
                  onChange={(e) => setCurrentScene(e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <span className="text-sm font-medium text-gray-900">{currentScene}</span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">担当:</label>
              {canEdit ? (
                <input
                  type="text"
                  value={sceneAssignee}
                  onChange={(e) => setSceneAssignee(e.target.value)}
                  placeholder="担当者名"
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <span className="text-sm text-gray-600">{sceneAssignee || '未設定'}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {linesError && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400 no-print error-message">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{linesError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Script Table */}
      <div className="flex-1 overflow-hidden">
        <ScriptTable
          scriptLines={scriptLines}
          isEditing={canEdit} // 編集権限がある場合は常に編集可能
          canEdit={canEdit}
          onLineUpdate={handleLineUpdate}
          onAddLine={handleAddLine}
          onInsertLine={handleInsertLine}
          className="h-full"
        />
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-2 no-print footer">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>行数: {scriptLines.length}</span>
          <span>最終更新: {script.updatedAt ? new Date(script.updatedAt).toLocaleString('ja-JP') : '未更新'}</span>
        </div>
      </div>

      {/* Page Number for Print */}
      <div className="page-number" style={{ display: 'none' }}>
        - <span id="page-number"></span> -
      </div>
    </div>
  );
};

export default ScriptViewer;