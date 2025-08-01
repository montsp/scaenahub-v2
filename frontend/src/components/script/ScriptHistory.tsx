import React, { useState, useEffect } from 'react';
import { Script, User } from '../../types';
import { apiService } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import {
  ClockIcon,
  UserIcon,
  EyeIcon,
  ArrowUturnLeftIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface ScriptHistoryProps {
  script: Script;
  onClose: () => void;
  onRestore?: (versionId: string) => void;
}

interface HistoryEntry {
  id: string;
  version: number;
  changes: {
    field: string;
    oldValue: string;
    newValue: string;
    lineNumber?: number;
  }[];
  user: User;
  timestamp: string;
  comment?: string;
}

const ScriptHistory: React.FC<ScriptHistoryProps> = ({
  script,
  onClose,
  onRestore,
}) => {
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const {
    data: historyData,
    loading: historyLoading,
    error: historyError,
    execute: fetchHistory,
  } = useApi(apiService.getScriptHistory);

  const {
    data: versionData,
    loading: versionLoading,
    execute: fetchVersion,
  } = useApi(apiService.getScriptVersion);

  useEffect(() => {
    fetchHistory(script.id);
  }, [script.id, fetchHistory]);

  const history: HistoryEntry[] = Array.isArray(historyData) 
    ? historyData 
    : historyData?.history || [];

  const handleViewVersion = async (entry: HistoryEntry) => {
    setSelectedEntry(entry);
    await fetchVersion(script.id, entry.version);
    setShowPreview(true);
  };

  const handleRestore = async (entry: HistoryEntry) => {
    if (onRestore && window.confirm(`バージョン ${entry.version} に復元しますか？現在の変更は失われます。`)) {
      onRestore(entry.id);
      onClose();
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getChangeDescription = (changes: HistoryEntry['changes']): string => {
    if (changes.length === 0) return '変更なし';
    
    const changeTypes = changes.reduce((acc, change) => {
      const fieldName = getFieldDisplayName(change.field);
      acc[fieldName] = (acc[fieldName] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    return Object.entries(changeTypes)
      .map(([field, count]) => `${field}(${count}件)`)
      .join(', ');
  };

  const getFieldDisplayName = (field: string): string => {
    const fieldNames: { [key: string]: string } = {
      characterName: '登場人物名',
      dialogue: '台詞',
      lighting: '照明',
      audioVideo: '音響・映像',
      notes: '備考',
      title: 'タイトル',
      description: '説明',
    };
    return fieldNames[field] || field;
  };

  const getChangeTypeColor = (oldValue: string, newValue: string): string => {
    if (!oldValue && newValue) return 'text-green-600'; // 追加
    if (oldValue && !newValue) return 'text-red-600'; // 削除
    return 'text-blue-600'; // 変更
  };

  const getChangeTypeIcon = (oldValue: string, newValue: string): string => {
    if (!oldValue && newValue) return '+'; // 追加
    if (oldValue && !newValue) return '-'; // 削除
    return '~'; // 変更
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <ClockIcon className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">編集履歴</h2>
              <p className="text-sm text-gray-600">{script.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors duration-200"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex h-[60vh]">
          {/* History List */}
          <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-4">変更履歴</h3>
              
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : historyError ? (
                <div className="text-center py-8 text-red-600">
                  <p className="text-sm">履歴の読み込みに失敗しました</p>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ClockIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">編集履歴がありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors duration-200 ${
                        selectedEntry?.id === entry.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedEntry(entry)}
                    >
                      {/* Entry Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900">
                            v{entry.version}
                          </span>
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <UserIcon className="h-3 w-3" />
                            <span>{entry.user.profile?.displayName || entry.user.username}</span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>

                      {/* Changes Summary */}
                      <div className="text-xs text-gray-600 mb-2">
                        {getChangeDescription(entry.changes)}
                      </div>

                      {/* Comment */}
                      {entry.comment && (
                        <div className="text-xs text-gray-500 italic">
                          "{entry.comment}"
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center space-x-2 mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewVersion(entry);
                          }}
                          className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors duration-200"
                        >
                          <EyeIcon className="h-3 w-3" />
                          <span>プレビュー</span>
                        </button>
                        {onRestore && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestore(entry);
                            }}
                            className="flex items-center space-x-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors duration-200"
                          >
                            <ArrowUturnLeftIcon className="h-3 w-3" />
                            <span>復元</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Details Panel */}
          <div className="w-1/2 overflow-y-auto">
            <div className="p-4">
              {selectedEntry ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-900">
                      バージョン {selectedEntry.version} の詳細
                    </h3>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(selectedEntry.timestamp)}
                    </span>
                  </div>

                  {/* User Info */}
                  <div className="flex items-center space-x-2 mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-600">
                        {(selectedEntry.user.profile?.displayName || selectedEntry.user.username).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {selectedEntry.user.profile?.displayName || selectedEntry.user.username}
                      </div>
                      <div className="text-xs text-gray-500">
                        {selectedEntry.user.roles?.includes('admin') ? '管理者' : 'メンバー'}
                      </div>
                    </div>
                  </div>

                  {/* Comment */}
                  {selectedEntry.comment && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <div className="text-xs font-medium text-gray-700 mb-1">コメント</div>
                      <div className="text-sm text-gray-900">{selectedEntry.comment}</div>
                    </div>
                  )}

                  {/* Changes */}
                  <div>
                    <div className="text-xs font-medium text-gray-700 mb-3">変更内容</div>
                    {selectedEntry.changes.length === 0 ? (
                      <div className="text-sm text-gray-500 italic">変更はありません</div>
                    ) : (
                      <div className="space-y-3">
                        {selectedEntry.changes.map((change, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className={`text-xs font-mono ${getChangeTypeColor(change.oldValue, change.newValue)}`}>
                                {getChangeTypeIcon(change.oldValue, change.newValue)}
                              </span>
                              <span className="text-sm font-medium text-gray-900">
                                {getFieldDisplayName(change.field)}
                              </span>
                              {change.lineNumber && (
                                <span className="text-xs text-gray-500">
                                  (行 {change.lineNumber})
                                </span>
                              )}
                            </div>
                            
                            {change.oldValue && (
                              <div className="mb-2">
                                <div className="text-xs text-gray-500 mb-1">変更前:</div>
                                <div className="text-sm text-red-600 bg-red-50 p-2 rounded border-l-2 border-red-200">
                                  {change.oldValue}
                                </div>
                              </div>
                            )}
                            
                            {change.newValue && (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">変更後:</div>
                                <div className="text-sm text-green-600 bg-green-50 p-2 rounded border-l-2 border-green-200">
                                  {change.newValue}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ClockIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">履歴エントリを選択してください</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Version Preview Modal */}
        {showPreview && selectedEntry && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  バージョン {selectedEntry.version} プレビュー
                </h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors duration-200"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[70vh]">
                {versionLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : versionData ? (
                  <div className="space-y-4">
                    {/* Version content would be displayed here */}
                    <div className="text-sm text-gray-600">
                      バージョン {selectedEntry.version} の内容がここに表示されます
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">プレビューを読み込めませんでした</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScriptHistory;