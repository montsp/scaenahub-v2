import { Script, ScriptLine, ScriptPermissions, ScriptFormatting } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class ScriptModel {
  public static validate(scriptData: Partial<Script>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // タイトル検証
    if (!scriptData.title) {
      errors.push('Script title is required');
    } else if (scriptData.title.length < 1 || scriptData.title.length > 200) {
      errors.push('Script title must be between 1 and 200 characters');
    }

    // 説明検証
    if (scriptData.description && scriptData.description.length > 1000) {
      errors.push('Script description must be 1000 characters or less');
    }

    // 権限検証
    if (scriptData.permissions) {
      const { viewRoles, editRoles, viewUsers, editUsers } = scriptData.permissions;
      if (viewRoles && !Array.isArray(viewRoles)) {
        errors.push('View roles must be an array');
      }
      if (editRoles && !Array.isArray(editRoles)) {
        errors.push('Edit roles must be an array');
      }
      if (viewUsers && !Array.isArray(viewUsers)) {
        errors.push('View users must be an array');
      }
      if (editUsers && !Array.isArray(editUsers)) {
        errors.push('Edit users must be an array');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public static validateLine(lineData: Partial<ScriptLine>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 行番号検証
    if (lineData.lineNumber !== undefined && (lineData.lineNumber < 1 || lineData.lineNumber > 10000)) {
      errors.push('Line number must be between 1 and 10000');
    }

    // 登場人物名検証
    if (lineData.characterName && lineData.characterName.length > 100) {
      errors.push('Character name must be 100 characters or less');
    }

    // 各フィールドの長さ検証
    if (lineData.dialogue && lineData.dialogue.length > 2000) {
      errors.push('Dialogue must be 2000 characters or less');
    }
    if (lineData.lighting && lineData.lighting.length > 500) {
      errors.push('Lighting must be 500 characters or less');
    }
    if (lineData.audioVideo && lineData.audioVideo.length > 500) {
      errors.push('Audio/Video must be 500 characters or less');
    }
    if (lineData.notes && lineData.notes.length > 1000) {
      errors.push('Notes must be 1000 characters or less');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public static create(scriptData: {
    title: string;
    description?: string;
    isActive?: boolean;
    permissions?: Partial<ScriptPermissions>;
    createdBy: string;
  }): Script {
    const now = new Date();
    
    const defaultPermissions: ScriptPermissions = {
      viewRoles: ['member'],
      editRoles: ['admin'],
      viewUsers: [],
      editUsers: []
    };

    const script: Script = {
      id: uuidv4(),
      title: scriptData.title,
      isActive: scriptData.isActive !== undefined ? scriptData.isActive : true,
      permissions: { ...defaultPermissions, ...scriptData.permissions },
      createdBy: scriptData.createdBy,
      createdAt: now,
      updatedAt: now
    };
    
    if (scriptData.description) {
      script.description = scriptData.description;
    }
    
    const validation = ScriptModel.validate(script);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return script;
  }

  public static createLine(lineData: {
    scriptId: string;
    lineNumber: number;
    characterName?: string;
    dialogue?: string;
    lighting?: string;
    audioVideo?: string;
    notes?: string;
    formatting?: Partial<ScriptFormatting>;
    lastEditedBy?: string;
  }): ScriptLine {
    const now = new Date();
    
    const defaultFormatting: ScriptFormatting = {
      bold: false,
      underline: false,
      italic: false,
      color: '#000000'
    };

    const scriptLine: ScriptLine = {
      id: uuidv4(),
      scriptId: lineData.scriptId,
      lineNumber: lineData.lineNumber,
      characterName: lineData.characterName || '',
      dialogue: lineData.dialogue || '',
      lighting: lineData.lighting || '',
      audioVideo: lineData.audioVideo || '',
      notes: lineData.notes || '',
      formatting: { ...defaultFormatting, ...lineData.formatting },
      lastEditedBy: lineData.lastEditedBy || '',
      createdAt: now,
      updatedAt: now
    };
    
    const validation = ScriptModel.validateLine(scriptLine);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return scriptLine;
  }

  public static getDialogueColor(text: string): string {
    // 動きや指示を表すパターン
    const actionPatterns = [
      /^\\(.*\\)$/, // (動作)
      /^【.*】$/, // 【指示】
      /^\\[.*\\]$/, // [動作]
      /^＜.*＞$/, // ＜指示＞
    ];

    // いずれかのパターンにマッチする場合は青字（動き）
    for (const pattern of actionPatterns) {
      if (pattern.test(text.trim())) {
        return '#0066cc'; // 青字
      }
    }

    // それ以外は黒字（台詞）
    return '#000000';
  }
}