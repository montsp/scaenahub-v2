import React, { useState } from 'react';
import { ScriptLine, User } from '../../types';
import {
  ExclamationTriangleIcon,
  UserIcon,
  ClockIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface ConflictData {
  lineId: string;
  field: string;
  currentValue: string;
  conflictingValue: string;
  conflictingUser: User;
  timestamp: string;
}

interface ConflictResolverProps {
  conflicts: ConflictData[];
  onResolve: (lineId: string, field: string, selectedValue: string) => void;
  onClose: () => void;
}

const ConflictResolver: React.FC<ConflictResolverProps> = ({
  conflicts,
  onResolve,
  onClose,
}) => {
  const [resolutions, setResolutions] = useState<{ [key: string]: string }>({});

  const handleResolutionChange = (conflictKey: string, value: string) => {
    setResolutions(prev => ({
      ...prev,
      [conflictKey]: value,
    }));
  };

  const handleResolveAll = () => {
    conflicts.forEach(conflict => {
      const conflictKey = `${conflict.lineId}-${conflict.field}`;
      const selectedValue = resolutions[conflictKey] || conflict.currentValue;
      onResolve(conflict.lineId, conflict.field, selectedValue);
    });
    onClose();
  };

  const getFieldDisplayName = (field: string): string => {
    const fieldNames: { [key: string]: string } = {
      characterName: '登場人物名',
      dialogue: '台詞',
      lighting: '照明',
      audioVideo: '音響・映像',
      notes: '備考',
    };
    return fieldNames[field] || field;
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-yellow-50">
          <div className="flex items-center space-x-3">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">編集競合の解決</h2>
              <p className="text-sm text-gray-600">
                他のユーザーが同時に編集した内容との競合が発生しました
              </p>
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
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="space-y-6">
            {conflicts.map((conflict, index) => {
              const conflictKey = `${conflict.lineId}-${conflict.field}`;
              const selectedValue = resolutions[conflictKey];

              return (
                <div key={conflictKey} className="border border-gray-200 rounded-lg p-4">
                  {/* Conflict Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        競合 #{index + 1}
                      </span>
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {getFieldDisplayName(conflict.field)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <ClockIcon className="h-4 w-4" />
                      <span>{formatTimestamp(conflict.timestamp)}</span>
                    </div>
                  </div>

                  {/* Conflict Options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Current Version */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id={`${conflictKey}-current`}
                          name={conflictKey}
                          value={conflict.currentValue}
                          checked={selectedValue === conflict.currentValue || (!selectedValue && true)}
                          onChange={(e) => handleResolutionChange(conflictKey, e.target.value)}
                          className="text-blue-600"
                        />
                        <label
                          htmlFor={`${conflictKey}-current`}
                          className="text-sm font-medium text-gray-900 cursor-pointer"
                        >
                          あなたの変更を保持
                        </label>
                      </div>
                      <div className="ml-6 p-3 bg-green-50 border border-green-200 rounded">
                        <div className="text-sm text-gray-900 whitespace-pre-wrap">
                          {conflict.currentValue || (
                            <span className="text-gray-400 italic">（空）</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Conflicting Version */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id={`${conflictKey}-conflicting`}
                          name={conflictKey}
                          value={conflict.conflictingValue}
                          checked={selectedValue === conflict.conflictingValue}
                          onChange={(e) => handleResolutionChange(conflictKey, e.target.value)}
                          className="text-blue-600"
                        />
                        <label
                          htmlFor={`${conflictKey}-conflicting`}
                          className="text-sm font-medium text-gray-900 cursor-pointer flex items-center space-x-2"
                        >
                          <span>他のユーザーの変更を採用</span>
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <UserIcon className="h-3 w-3" />
                            <span>{conflict.conflictingUser.profile?.displayName || conflict.conflictingUser.username}</span>
                          </div>
                        </label>
                      </div>
                      <div className="ml-6 p-3 bg-blue-50 border border-blue-200 rounded">
                        <div className="text-sm text-gray-900 whitespace-pre-wrap">
                          {conflict.conflictingValue || (
                            <span className="text-gray-400 italic">（空）</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Diff Visualization */}
                  {conflict.currentValue && conflict.conflictingValue && (
                    <div className="mt-4 p-3 bg-gray-50 rounded">
                      <div className="text-xs font-medium text-gray-700 mb-2">変更の比較</div>
                      <div className="text-sm space-y-1">
                        <div className="flex items-start space-x-2">
                          <span className="text-red-600 font-mono">-</span>
                          <span className="text-red-600 line-through">{conflict.currentValue}</span>
                        </div>
                        <div className="flex items-start space-x-2">
                          <span className="text-green-600 font-mono">+</span>
                          <span className="text-green-600">{conflict.conflictingValue}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {conflicts.length}件の競合を解決してください
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              キャンセル
            </button>
            <button
              onClick={handleResolveAll}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <CheckIcon className="h-4 w-4" />
              <span>すべて解決</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolver;