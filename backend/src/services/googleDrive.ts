import { google } from 'googleapis';
import { Attachment } from '../types';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export class GoogleDriveService {
  private static instance: GoogleDriveService;
  private drive: any;
  private auth: any;
  private readonly FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
  private readonly MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880'); // 5MB

  constructor() {
    this.initializeAuth();
  }

  public static getInstance(): GoogleDriveService {
    if (!GoogleDriveService.instance) {
      GoogleDriveService.instance = new GoogleDriveService();
    }
    return GoogleDriveService.instance;
  }

  // Google Drive認証初期化
  private initializeAuth(): void {
    try {
      const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || '{}');
      
      this.auth = new google.auth.GoogleAuth({
        credentials: serviceAccount,
        scopes: ['https://www.googleapis.com/auth/drive']
      });

      this.drive = google.drive({ version: 'v3', auth: this.auth });
    } catch (error) {
      console.error('Failed to initialize Google Drive auth:', error);
      throw new Error('Google Drive authentication failed');
    }
  }

  // ファイルアップロード
  public async uploadFile(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
    userId: string
  ): Promise<Attachment> {
    try {
      // ファイルサイズチェック
      if (fileBuffer.length > this.MAX_FILE_SIZE) {
        throw new Error(`File size exceeds limit of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
      }

      // ファイル名の安全化
      const safeFilename = this.sanitizeFilename(filename);
      const uniqueFilename = `${Date.now()}_${userId}_${safeFilename}`;

      // Google Driveにアップロード
      const fileMetadata = {
        name: uniqueFilename,
        parents: this.FOLDER_ID ? [this.FOLDER_ID] : undefined
      };

      const media = {
        mimeType,
        body: Buffer.from(fileBuffer)
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id,name,size,mimeType,webViewLink,webContentLink'
      });

      const file = response.data;

      // ファイルを公開設定にする
      await this.drive.permissions.create({
        fileId: file.id,
        resource: {
          role: 'reader',
          type: 'anyone'
        }
      });

      // Attachmentオブジェクトを作成
      const attachment: Attachment = {
        id: uuidv4(),
        filename: safeFilename,
        mimeType,
        size: fileBuffer.length,
        googleDriveId: file.id,
        url: file.webContentLink || file.webViewLink
      };

      return attachment;
    } catch (error) {
      console.error('Failed to upload file to Google Drive:', error);
      throw new Error('File upload failed');
    }
  }

  // 複数ファイルの一括アップロード
  public async uploadFiles(
    files: Array<{
      buffer: Buffer;
      filename: string;
      mimeType: string;
    }>,
    userId: string
  ): Promise<Attachment[]> {
    const uploadPromises = files.map(file =>
      this.uploadFile(file.buffer, file.filename, file.mimeType, userId)
    );

    try {
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Failed to upload multiple files:', error);
      throw new Error('Multiple file upload failed');
    }
  }

  // ファイル削除
  public async deleteFile(googleDriveId: string): Promise<void> {
    try {
      await this.drive.files.delete({
        fileId: googleDriveId
      });
    } catch (error) {
      console.error(`Failed to delete file ${googleDriveId}:`, error);
      throw new Error('File deletion failed');
    }
  }

  // ファイル情報取得
  public async getFileInfo(googleDriveId: string): Promise<any> {
    try {
      const response = await this.drive.files.get({
        fileId: googleDriveId,
        fields: 'id,name,size,mimeType,webViewLink,webContentLink,createdTime,modifiedTime'
      });

      return response.data;
    } catch (error) {
      console.error(`Failed to get file info ${googleDriveId}:`, error);
      throw new Error('Failed to get file information');
    }
  }

  // ファイルダウンロードURL取得
  public async getDownloadUrl(googleDriveId: string): Promise<string> {
    try {
      const fileInfo = await this.getFileInfo(googleDriveId);
      return fileInfo.webContentLink || fileInfo.webViewLink;
    } catch (error) {
      console.error(`Failed to get download URL for ${googleDriveId}:`, error);
      throw new Error('Failed to get download URL');
    }
  }

  // ファイル名の安全化
  private sanitizeFilename(filename: string): string {
    // 危険な文字を除去
    const sanitized = filename.replace(/[<>:"/\\|?*]/g, '_');
    
    // 長すぎるファイル名を短縮
    if (sanitized.length > 100) {
      const ext = path.extname(sanitized);
      const name = path.basename(sanitized, ext);
      return name.substring(0, 100 - ext.length) + ext;
    }

    return sanitized;
  }

  // MIMEタイプの検証
  public isAllowedMimeType(mimeType: string): boolean {
    const allowedTypes = [
      // 画像
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      
      // 動画
      'video/mp4',
      'video/webm',
      'video/ogg',
      
      // 音声
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      
      // ドキュメント
      'application/pdf',
      'text/plain',
      'text/markdown',
      
      // Microsoft Office
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      
      // アーカイブ
      'application/zip',
      'application/x-rar-compressed'
    ];

    return allowedTypes.includes(mimeType);
  }

  // ファイルサイズの検証
  public isAllowedFileSize(size: number): boolean {
    return size <= this.MAX_FILE_SIZE;
  }

  // 画像ファイルかどうかチェック
  public isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  // 動画ファイルかどうかチェック
  public isVideoFile(mimeType: string): boolean {
    return mimeType.startsWith('video/');
  }

  // 音声ファイルかどうかチェック
  public isAudioFile(mimeType: string): boolean {
    return mimeType.startsWith('audio/');
  }

  // ストレージ使用量取得
  public async getStorageUsage(): Promise<{
    used: number;
    limit: number;
    available: number;
  }> {
    try {
      const response = await this.drive.about.get({
        fields: 'storageQuota'
      });

      const quota = response.data.storageQuota;
      const used = parseInt(quota.usage || '0');
      const limit = parseInt(quota.limit || '15000000000'); // 15GB default
      const available = limit - used;

      return { used, limit, available };
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      throw new Error('Failed to get storage usage');
    }
  }

  // フォルダ内のファイル一覧取得
  public async listFiles(
    folderId?: string,
    pageSize: number = 100
  ): Promise<any[]> {
    try {
      const query = folderId ? `'${folderId}' in parents` : undefined;
      
      const response = await this.drive.files.list({
        q: query,
        pageSize,
        fields: 'files(id,name,size,mimeType,createdTime,modifiedTime)',
        orderBy: 'createdTime desc'
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Failed to list files:', error);
      throw new Error('Failed to list files');
    }
  }
}