import React, { useState, useRef, useCallback, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { User } from '../../types';
import { apiService } from '../../services/api';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxLength?: number;
}

interface MentionSuggestion {
  id: string;
  username: string;
  displayName?: string;
  type: 'user' | 'role';
}

const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  onKeyDown,
  placeholder = 'メッセージを入力...',
  disabled = false,
  className = '',
  maxLength = 2000,
}) => {
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const textareaRef = useRef<any>(null);

  // Load users for mentions
  const loadUsers = useCallback(async (query: string) => {
    try {
      const response = await apiService.searchUsers(query);
      if (response.success && response.data) {
        const users = Array.isArray(response.data) ? response.data : (response.data as any)?.users || [];
        const userSuggestions: MentionSuggestion[] = users.map((user: User) => ({
          id: user.id,
          username: user.username,
          displayName: user.profile?.displayName,
          type: 'user' as const,
        }));
        setSuggestions(userSuggestions);
      }
    } catch (error) {
      console.error('Failed to load users for mentions:', error);
      // For now, provide some mock suggestions since backend API is not implemented
      const mockUsers: MentionSuggestion[] = [
        { id: '1', username: 'admin', displayName: '管理者', type: 'user' as const },
        { id: '2', username: 'user1', displayName: 'ユーザー1', type: 'user' as const },
        { id: '3', username: 'user2', displayName: 'ユーザー2', type: 'user' as const },
      ].filter(user => 
        query === '' || 
        user.username.toLowerCase().includes(query.toLowerCase()) ||
        (user.displayName && user.displayName.includes(query))
      );
      setSuggestions(mockUsers);
    }
  }, []);

  // Handle input changes and detect mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart;

    // Limit message length
    if (newValue.length > maxLength) return;

    onChange(newValue);

    // Check for mention trigger (@)
    const textBeforeCursor = newValue.substring(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      const start = cursorPosition - mentionMatch[0].length;
      
      setMentionQuery(query);
      setMentionStart(start);
      setShowSuggestions(true);
      setSelectedSuggestion(0);
      
      // Load suggestions if query is not empty or show all users
      if (query.length >= 0) {
        loadUsers(query);
      }
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
      setMentionQuery('');
      setMentionStart(-1);
    }
  };

  // Handle keyboard navigation in suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedSuggestion(prev => 
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedSuggestion(prev => 
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'Tab':
        case 'Enter':
          if (e.key === 'Enter' && e.shiftKey) {
            // Allow Shift+Enter for new line
            break;
          }
          if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && showSuggestions)) {
            e.preventDefault();
            insertMention(suggestions[selectedSuggestion]);
            return;
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowSuggestions(false);
          break;
      }
    }

    // Call parent onKeyDown handler
    onKeyDown?.(e);
  };

  // Insert selected mention into text
  const insertMention = (suggestion: MentionSuggestion) => {
    if (mentionStart === -1) return;

    const beforeMention = value.substring(0, mentionStart);
    const afterMention = value.substring(mentionStart + mentionQuery.length + 1); // +1 for @
    const mentionText = `@${suggestion.username}`;
    const newValue = beforeMention + mentionText + ' ' + afterMention;

    onChange(newValue);
    setShowSuggestions(false);
    setSuggestions([]);
    setMentionQuery('');
    setMentionStart(-1);

    // Focus back to textarea and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPosition = mentionStart + mentionText.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    }, 0);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: MentionSuggestion) => {
    insertMention(suggestion);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const remainingChars = maxLength - value.length;
  const isNearLimit = remainingChars < 100;

  return (
    <div className={`relative ${className}`}>
      {/* Character count warning */}
      {isNearLimit && (
        <div className="mb-2 text-right">
          <span className={`text-xs ${remainingChars < 50 ? 'text-red-500' : 'text-yellow-600'}`}>
            残り {remainingChars} 文字
          </span>
        </div>
      )}

      {/* Textarea */}
      <TextareaAutosize
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 sm:px-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 resize-none text-sm sm:text-base"
        minRows={1}
        maxRows={6}
        style={{ fontSize: '16px' }} // Prevent zoom on iOS
      />

      {/* Mention suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              onClick={() => handleSuggestionClick(suggestion)}
              className={`w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors duration-200 ${
                index === selectedSuggestion ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                  {(suggestion.displayName || suggestion.username).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">
                    {suggestion.displayName || suggestion.username}
                  </div>
                  {suggestion.displayName && (
                    <div className="text-xs text-gray-500">@{suggestion.username}</div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Markdown help text */}
      <div className="mt-2 text-xs text-gray-500 space-y-1">
        <div>**太字** *斜体* ~~取り消し線~~ `コード` @ユーザー名</div>
        <div className="hidden sm:block">Shift+Enter で改行、Tab または Enter でメンション選択</div>
      </div>
    </div>
  );
};

export default MentionInput;