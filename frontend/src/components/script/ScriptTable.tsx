import React, { useState, useRef, useEffect } from 'react';
import { ScriptLine } from '../../types';
import ScriptCell from './ScriptCell';

interface ScriptTableProps {
  scriptLines: ScriptLine[];
  isEditing: boolean;
  canEdit: boolean;
  onLineUpdate: (lineId: string, updates: Partial<ScriptLine>) => void;
  onAddLine: () => void;
  onInsertLine?: (afterLineNumber: number) => void;
  className?: string;
}

const ScriptTable: React.FC<ScriptTableProps> = ({
  scriptLines,
  isEditing,
  canEdit,
  onLineUpdate,
  onAddLine,
  onInsertLine,
  className = '',
}) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const [selectedCell, setSelectedCell] = useState<{ lineId: string; field: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ lineId: string; field: string } | null>(null);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, lineId: string, field: string) => {
    if (!canEdit) return;

    const currentIndex = scriptLines.findIndex(line => line.id === lineId);
    const fields = ['characterName', 'dialogue', 'lighting', 'audioVideo', 'notes'];
    const currentFieldIndex = fields.indexOf(field);

    switch (e.key) {
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          // Move to previous cell
          if (currentFieldIndex > 0) {
            const newCell = { lineId, field: fields[currentFieldIndex - 1] };
            setSelectedCell(newCell);
            setEditingCell(newCell);
          } else if (currentIndex > 0) {
            const newCell = { lineId: scriptLines[currentIndex - 1].id, field: fields[fields.length - 1] };
            setSelectedCell(newCell);
            setEditingCell(newCell);
          }
        } else {
          // Move to next cell
          if (currentFieldIndex < fields.length - 1) {
            const newCell = { lineId, field: fields[currentFieldIndex + 1] };
            setSelectedCell(newCell);
            setEditingCell(newCell);
          } else if (currentIndex < scriptLines.length - 1) {
            const newCell = { lineId: scriptLines[currentIndex + 1].id, field: fields[0] };
            setSelectedCell(newCell);
            setEditingCell(newCell);
          }
        }
        break;
      case 'Enter':
        if (!e.shiftKey) {
          e.preventDefault();
          // Move to next row, same column
          if (currentIndex < scriptLines.length - 1) {
            const newCell = { lineId: scriptLines[currentIndex + 1].id, field };
            setSelectedCell(newCell);
            setEditingCell(newCell);
          }
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (currentIndex > 0) {
          const newCell = { lineId: scriptLines[currentIndex - 1].id, field };
          setSelectedCell(newCell);
          setEditingCell(newCell);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (currentIndex < scriptLines.length - 1) {
          const newCell = { lineId: scriptLines[currentIndex + 1].id, field };
          setSelectedCell(newCell);
          setEditingCell(newCell);
        }
        break;
    }
  };

  // Auto-scroll to selected cell
  useEffect(() => {
    if (selectedCell && tableRef.current) {
      const cellElement = tableRef.current.querySelector(
        `[data-line-id="${selectedCell.lineId}"][data-field="${selectedCell.field}"]`
      );
      if (cellElement) {
        cellElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedCell]);

  const handleCellUpdate = (lineId: string, field: string, value: string) => {
    onLineUpdate(lineId, { [field]: value });
  };

  const handleCellFocus = (lineId: string, field: string) => {
    setSelectedCell({ lineId, field });
    setEditingCell({ lineId, field });
    
    // 最終行のセルを触った時に自動で次の行を追加（一度だけ）
    const currentIndex = scriptLines.findIndex(line => line.id === lineId);
    if (currentIndex === scriptLines.length - 1 && canEdit && scriptLines.length > 0) {
      // 最終行が空でない場合のみ新しい行を追加
      const lastLine = scriptLines[currentIndex];
      const hasContent = lastLine.characterName || lastLine.dialogue || lastLine.lighting || lastLine.audioVideo || lastLine.notes;
      
      if (hasContent) {
        // 少し遅延させて、現在の編集が完了してから新しい行を追加
        setTimeout(() => {
          onAddLine();
        }, 500);
      }
    }
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const getDialogueColor = (text: string): string => {
    // 動きを示すパターンを検出（括弧内のテキスト、動作を表す語句など）
    const actionPatterns = [
      /\([^)]+\)/g, // 括弧内
      /（[^）]+）/g, // 全角括弧内
      /\[[^\]]+\]/g, // 角括弧内
      /【[^】]+】/g, // 隅付き括弧内
    ];
    
    const hasAction = actionPatterns.some(pattern => pattern.test(text));
    return hasAction ? 'text-blue-600' : 'text-black';
  };

  if (scriptLines.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="text-center py-12">
          <svg className="h-12 w-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 mb-4">脚本の内容がありません</p>
          {canEdit && (
            <button
              onClick={onAddLine}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              最初の行を追加
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-auto print-container ${className}`} ref={tableRef}>
      {/* 印刷時用のシンプルテーブル */}
      <table className="script-table-print print-only-tables">
        <thead>
          <tr>
            <th>登場人物名</th>
            <th>台詞（動き等）</th>
            <th>照明</th>
            <th>音響・映像</th>
            <th>備考</th>
          </tr>
        </thead>
        <tbody>
          {scriptLines.map((line) => (
            <tr key={`print-${line.id}`}>
              <td className="character-column">
                {line.characterName || ''}
              </td>
              <td className="dialogue-column">
                {line.dialogue || ''}
              </td>
              <td className="lighting-column">
                {line.lighting || ''}
              </td>
              <td className="audio-video-column">
                {line.audioVideo || ''}
              </td>
              <td className="notes-column">
                {line.notes || ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 通常表示用のテーブル */}
      <table className="w-full border-collapse border border-gray-300 script-table screen-only-table">
        {/* Table Header */}
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            {canEdit && (
              <th className="border border-gray-300 px-1 py-2 text-center text-sm font-medium text-gray-700 w-8 no-print">
                操作
              </th>
            )}
            <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 w-24 character-column">
              登場人物名
            </th>
            <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 min-w-96 dialogue-column">
              台詞（動き等）
            </th>
            <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 w-32 lighting-column">
              照明
            </th>
            <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 w-32 audio-video-column">
              音響・映像
            </th>
            <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 w-32 notes-column">
              備考
            </th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {scriptLines.map((line) => (
            <tr key={line.id} className="hover:bg-gray-50 script-row">
              {/* Insert Line Button */}
              {canEdit && (
                <td className="border border-gray-300 p-1 align-top text-center no-print">
                  <button
                    onClick={() => onInsertLine && onInsertLine(line.lineNumber)}
                    className="w-6 h-6 text-xs bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-600 rounded border transition-colors duration-200"
                    title="この行の後に新しい行を挿入"
                  >
                    +
                  </button>
                </td>
              )}
              
              {/* Character Name */}
              <td className="border border-gray-300 p-0 align-top character-column">
                <ScriptCell
                  value={line.characterName}
                  isEditing={editingCell?.lineId === line.id && editingCell?.field === 'characterName'}
                  canEdit={canEdit}
                  onEdit={(value) => handleCellUpdate(line.id, 'characterName', value)}
                  onFocus={() => handleCellFocus(line.id, 'characterName')}
                  onBlur={handleCellBlur}
                  onKeyDown={(e) => handleKeyDown(e, line.id, 'characterName')}
                  className="min-h-12 text-sm font-medium character-name script-cell"
                  placeholder="登場人物"
                  dataLineId={line.id}
                  dataField="characterName"
                />
              </td>

              {/* Dialogue */}
              <td className="border border-gray-300 p-0 align-top dialogue-column">
                <ScriptCell
                  value={line.dialogue}
                  isEditing={editingCell?.lineId === line.id && editingCell?.field === 'dialogue'}
                  canEdit={canEdit}
                  onEdit={(value) => handleCellUpdate(line.id, 'dialogue', value)}
                  onFocus={() => handleCellFocus(line.id, 'dialogue')}
                  onBlur={handleCellBlur}
                  onKeyDown={(e) => handleKeyDown(e, line.id, 'dialogue')}
                  className={`min-h-12 text-sm dialogue-content script-cell ${getDialogueColor(line.dialogue)}`}
                  placeholder="台詞や動きを入力"
                  multiline
                  dataLineId={line.id}
                  dataField="dialogue"
                />
              </td>

              {/* Lighting */}
              <td className="border border-gray-300 p-0 align-top lighting-column">
                <ScriptCell
                  value={line.lighting}
                  isEditing={editingCell?.lineId === line.id && editingCell?.field === 'lighting'}
                  canEdit={canEdit}
                  onEdit={(value) => handleCellUpdate(line.id, 'lighting', value)}
                  onFocus={() => handleCellFocus(line.id, 'lighting')}
                  onBlur={handleCellBlur}
                  onKeyDown={(e) => handleKeyDown(e, line.id, 'lighting')}
                  className="min-h-12 text-sm script-cell"
                  placeholder="照明"
                  dataLineId={line.id}
                  dataField="lighting"
                />
              </td>

              {/* Audio/Video */}
              <td className="border border-gray-300 p-0 align-top audio-video-column">
                <ScriptCell
                  value={line.audioVideo}
                  isEditing={editingCell?.lineId === line.id && editingCell?.field === 'audioVideo'}
                  canEdit={canEdit}
                  onEdit={(value) => handleCellUpdate(line.id, 'audioVideo', value)}
                  onFocus={() => handleCellFocus(line.id, 'audioVideo')}
                  onBlur={handleCellBlur}
                  onKeyDown={(e) => handleKeyDown(e, line.id, 'audioVideo')}
                  className="min-h-12 text-sm script-cell"
                  placeholder="音響・映像"
                  dataLineId={line.id}
                  dataField="audioVideo"
                />
              </td>

              {/* Notes */}
              <td className="border border-gray-300 p-0 align-top notes-column">
                <ScriptCell
                  value={line.notes}
                  isEditing={editingCell?.lineId === line.id && editingCell?.field === 'notes'}
                  canEdit={canEdit}
                  onEdit={(value) => handleCellUpdate(line.id, 'notes', value)}
                  onFocus={() => handleCellFocus(line.id, 'notes')}
                  onBlur={handleCellBlur}
                  onKeyDown={(e) => handleKeyDown(e, line.id, 'notes')}
                  className="min-h-12 text-sm script-cell"
                  placeholder="備考"
                  dataLineId={line.id}
                  dataField="notes"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add Line Button */}
      {canEdit && (
        <div className="p-4 border-t border-gray-200 bg-gray-50 no-print">
          <button
            onClick={onAddLine}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>行を追加</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ScriptTable;