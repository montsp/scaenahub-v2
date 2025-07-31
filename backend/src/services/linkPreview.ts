import { Embed } from '../types';
import axios from 'axios';
import * as cheerio from 'cheerio';

export class LinkPreviewService {
  private static instance: LinkPreviewService;
  private cache: Map<string, Embed> = new Map();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24時間

  public static getInstance(): LinkPreviewService {
    if (!LinkPreviewService.instance) {
      LinkPreviewService.instance = new LinkPreviewService();
    }
    return LinkPreviewService.instance;
  }

  // URLからリンクプレビューを生成
  public async generatePreview(url: string): Promise<Embed | null> {
    try {
      // キャッシュチェック
      const cached = this.cache.get(url);
      if (cached) {
        return cached;
      }

      // URLの妥当性チェック
      if (!this.isValidUrl(url)) {
        return null;
      }

      // 画像・動画URLの場合は直接メディアプレビューを生成
      if (this.isImageUrl(url)) {
        return this.createImageEmbed(url);
      }

      if (this.isVideoUrl(url)) {
        return this.createVideoEmbed(url);
      }

      // HTMLページのメタデータを取得
      const embed = await this.fetchPageMetadata(url);
      
      if (embed) {
        // キャッシュに保存
        this.cache.set(url, embed);
        
        // キャッシュクリーンアップ（24時間後）
        setTimeout(() => {
          this.cache.delete(url);
        }, this.CACHE_DURATION);
      }

      return embed;
    } catch (error) {
      console.error('Failed to generate link preview:', error);
      return null;
    }
  }

  // 複数URLのプレビューを一括生成
  public async generatePreviews(urls: string[]): Promise<Embed[]> {
    const previews = await Promise.allSettled(
      urls.map(url => this.generatePreview(url))
    );

    return previews
      .filter((result): result is PromiseFulfilledResult<Embed> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);
  }

  // HTMLページのメタデータを取得
  private async fetchPageMetadata(url: string): Promise<Embed | null> {
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'ScaenaHub-Bot/1.0 (+https://scaenahub.com)'
        },
        maxContentLength: 1024 * 1024 // 1MB制限
      });

      if (!response.data || typeof response.data !== 'string') {
        return null;
      }

      const $ = cheerio.load(response.data);
      
      // Open Graph メタデータを優先
      const ogTitle = $('meta[property="og:title"]').attr('content');
      const ogDescription = $('meta[property="og:description"]').attr('content');
      const ogImage = $('meta[property="og:image"]').attr('content');
      const ogType = $('meta[property="og:type"]').attr('content');

      // Twitter Card メタデータをフォールバック
      const twitterTitle = $('meta[name="twitter:title"]').attr('content');
      const twitterDescription = $('meta[name="twitter:description"]').attr('content');
      const twitterImage = $('meta[name="twitter:image"]').attr('content');

      // 標準HTMLメタデータをフォールバック
      const htmlTitle = $('title').text();
      const htmlDescription = $('meta[name="description"]').attr('content');

      const title = ogTitle || twitterTitle || htmlTitle || '';
      const description = ogDescription || twitterDescription || htmlDescription || '';
      const thumbnail = ogImage || twitterImage || '';

      if (!title && !description) {
        return null;
      }

      const embed: Embed = {
        type: 'link',
        url,
        title: title.trim().substring(0, 200), // 200文字制限
        description: description.trim().substring(0, 500), // 500文字制限
      };

      // サムネイル画像がある場合は追加
      if (thumbnail) {
        embed.thumbnail = this.resolveUrl(thumbnail, url);
      }

      return embed;
    } catch (error) {
      console.error(`Failed to fetch metadata for ${url}:`, error);
      return null;
    }
  }

  // 画像埋め込みを作成
  private createImageEmbed(url: string): Embed {
    return {
      type: 'image',
      url,
      title: this.extractFilename(url),
      thumbnail: url
    };
  }

  // 動画埋め込みを作成
  private createVideoEmbed(url: string): Embed {
    return {
      type: 'video',
      url,
      title: this.extractFilename(url)
    };
  }

  // URLの妥当性チェック
  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }

  // 画像URLかどうかチェック
  private isImageUrl(url: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    const lowercaseUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowercaseUrl.includes(ext));
  }

  // 動画URLかどうかチェック
  private isVideoUrl(url: string): boolean {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
    const lowercaseUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowercaseUrl.includes(ext));
  }

  // 相対URLを絶対URLに変換
  private resolveUrl(relativeUrl: string, baseUrl: string): string {
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch {
      return relativeUrl;
    }
  }

  // URLからファイル名を抽出
  private extractFilename(url: string): string {
    try {
      const pathname = new URL(url).pathname;
      const filename = pathname.split('/').pop() || '';
      return decodeURIComponent(filename);
    } catch {
      return 'Media File';
    }
  }

  // キャッシュクリア
  public clearCache(): void {
    this.cache.clear();
  }

  // キャッシュサイズ取得
  public getCacheSize(): number {
    return this.cache.size;
  }
}