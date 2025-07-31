import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  ApiResponse, 
  PaginatedResponse, 
  LoginCredentials, 
  RegisterData, 
  AuthResponse,
  User,
  UserProfile,
  Channel,
  ChannelCategory,
  Message,
  Role,
  Script,
  ScriptLine
} from '../types';

class ApiService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    console.log('🔧 ApiService constructor called');
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    console.log('🔧 BaseURL:', this.baseURL);
    
    this.api = axios.create({
      baseURL: `${this.baseURL}/api`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('🔧 Axios instance created:', !!this.api);

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.api.post('/auth/login', credentials);
    return response.data;
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.api.post('/auth/register', data);
    return response.data;
  }

  async logout(): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.post('/auth/logout');
    return response.data;
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    const response: AxiosResponse<ApiResponse<User>> = await this.api.get('/auth/me');
    return response.data;
  }

  async refreshToken(): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.api.post('/auth/refresh');
    return response.data;
  }

  // User profile endpoints
  async getUserProfile(userId: string): Promise<ApiResponse<UserProfile>> {
    const response: AxiosResponse<ApiResponse<UserProfile>> = await this.api.get(`/profile/${userId}`);
    return response.data;
  }

  async updateUserProfile(data: Partial<UserProfile>): Promise<ApiResponse<UserProfile>> {
    const response: AxiosResponse<ApiResponse<UserProfile>> = await this.api.put('/profile', data);
    return response.data;
  }

  async updateOnlineStatus(status: UserProfile['onlineStatus']): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.put('/profile/status', { onlineStatus: status });
    return response.data;
  }

  async setCustomStatus(status: string, emoji?: string, expiresAt?: Date): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.put('/profile/custom-status', {
      customStatus: status,
      customStatusEmoji: emoji,
      customStatusExpiresAt: expiresAt,
    });
    return response.data;
  }

  // Channel endpoints
  getChannels = async (): Promise<ApiResponse<Channel[]>> => {
    console.log('🔧 getChannels called, this.api:', !!this.api);
    if (!this.api) {
      throw new Error('API instance not initialized');
    }
    const response: AxiosResponse<ApiResponse<Channel[]>> = await this.api.get('/channels');
    return response.data;
  }

  async getChannel(channelId: string): Promise<ApiResponse<Channel>> {
    const response: AxiosResponse<ApiResponse<Channel>> = await this.api.get(`/channels/${channelId}`);
    return response.data;
  }

  createChannel = async (data: Partial<Channel>): Promise<ApiResponse<Channel>> => {
    const response: AxiosResponse<ApiResponse<Channel>> = await this.api.post('/channels', data);
    return response.data;
  }

  async updateChannel(channelId: string, data: Partial<Channel>): Promise<ApiResponse<Channel>> {
    const response: AxiosResponse<ApiResponse<Channel>> = await this.api.put(`/channels/${channelId}`, data);
    return response.data;
  }

  async deleteChannel(channelId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.delete(`/channels/${channelId}`);
    return response.data;
  }

  // Channel categories
  getChannelCategories = async (): Promise<ApiResponse<ChannelCategory[]>> => {
    console.log('🔧 getChannelCategories called, this.api:', !!this.api);
    if (!this.api) {
      throw new Error('API instance not initialized');
    }
    const response: AxiosResponse<ApiResponse<ChannelCategory[]>> = await this.api.get('/channels/categories');
    return response.data;
  }

  async createChannelCategory(data: Partial<ChannelCategory>): Promise<ApiResponse<ChannelCategory>> {
    const response: AxiosResponse<ApiResponse<ChannelCategory>> = await this.api.post('/channels/categories', data);
    return response.data;
  }

  // Message endpoints
  getMessages = async (channelId: string, page = 1, limit = 50): Promise<ApiResponse<Message[]>> => {
    const response: AxiosResponse<ApiResponse<Message[]>> = await this.api.get(
      `/channels/${channelId}/messages?page=${page}&limit=${limit}`
    );
    return response.data;
  }

  sendMessage = async (channelId: string, content: string, replyToId?: string): Promise<ApiResponse<Message>> => {
    const response: AxiosResponse<ApiResponse<Message>> = await this.api.post(`/channels/${channelId}/messages`, {
      content,
      replyToId,
    });
    return response.data;
  }

  editMessage = async (messageId: string, content: string): Promise<ApiResponse<Message>> => {
    const response: AxiosResponse<ApiResponse<Message>> = await this.api.put(`/messages/${messageId}`, { content });
    return response.data;
  }

  deleteMessage = async (messageId: string): Promise<ApiResponse> => {
    const response: AxiosResponse<ApiResponse> = await this.api.delete(`/messages/${messageId}`);
    return response.data;
  }

  addReaction = async (messageId: string, emoji: string): Promise<ApiResponse> => {
    const response: AxiosResponse<ApiResponse> = await this.api.post(`/messages/${messageId}/reactions`, { emoji });
    return response.data;
  }

  async removeReaction(messageId: string, emoji: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.delete(`/messages/${messageId}/reactions/${emoji}`);
    return response.data;
  }

  async pinMessage(messageId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.post(`/messages/${messageId}/pin`);
    return response.data;
  }

  async unpinMessage(messageId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.delete(`/messages/${messageId}/pin`);
    return response.data;
  }

  // Search endpoints
  async searchMessages(query: string, channelId?: string, userId?: string): Promise<PaginatedResponse<Message>> {
    const params = new URLSearchParams({ query });
    if (channelId) params.append('channelId', channelId);
    if (userId) params.append('userId', userId);
    
    const response: AxiosResponse<PaginatedResponse<Message>> = await this.api.get(`/search/messages?${params}`);
    return response.data;
  }

  // Role endpoints
  async getRoles(): Promise<ApiResponse<Role[]>> {
    const response: AxiosResponse<ApiResponse<Role[]>> = await this.api.get('/roles');
    return response.data;
  }

  async createRole(data: Partial<Role>): Promise<ApiResponse<Role>> {
    const response: AxiosResponse<ApiResponse<Role>> = await this.api.post('/roles', data);
    return response.data;
  }

  async updateRole(roleId: string, data: Partial<Role>): Promise<ApiResponse<Role>> {
    const response: AxiosResponse<ApiResponse<Role>> = await this.api.put(`/roles/${roleId}`, data);
    return response.data;
  }

  async deleteRole(roleId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.delete(`/roles/${roleId}`);
    return response.data;
  }

  // Script endpoints
  getScripts = async (): Promise<ApiResponse<Script[]>> => {
    const response: AxiosResponse<ApiResponse<Script[]>> = await this.api.get('/scripts');
    return response.data;
  }

  getScript = async (scriptId: string): Promise<ApiResponse<Script>> => {
    const response: AxiosResponse<ApiResponse<Script>> = await this.api.get(`/scripts/${scriptId}`);
    return response.data;
  }

  createScript = async (data: Partial<Script>): Promise<ApiResponse<Script>> => {
    const response: AxiosResponse<ApiResponse<Script>> = await this.api.post('/scripts', data);
    return response.data;
  }

  async updateScript(scriptId: string, data: Partial<Script>): Promise<ApiResponse<Script>> {
    const response: AxiosResponse<ApiResponse<Script>> = await this.api.put(`/scripts/${scriptId}`, data);
    return response.data;
  }

  async deleteScript(scriptId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.delete(`/scripts/${scriptId}`);
    return response.data;
  }

  // Script lines
  getScriptLines = async (scriptId: string): Promise<ApiResponse<ScriptLine[]>> => {
    const response: AxiosResponse<ApiResponse<ScriptLine[]>> = await this.api.get(`/scripts/${scriptId}/lines`);
    return response.data;
  }

  createScriptLine = async (scriptId: string, data: Partial<ScriptLine>): Promise<ApiResponse<ScriptLine>> => {
    const response: AxiosResponse<ApiResponse<ScriptLine>> = await this.api.post(`/scripts/${scriptId}/lines`, data);
    return response.data;
  }

  updateScriptLine = async (scriptId: string, lineNumber: number, data: Partial<ScriptLine>): Promise<ApiResponse<ScriptLine>> => {
    const response: AxiosResponse<ApiResponse<ScriptLine>> = await this.api.put(`/scripts/${scriptId}/lines/${lineNumber}`, data);
    return response.data;
  }

  async deleteScriptLine(scriptId: string, lineNumber: number): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.delete(`/scripts/${scriptId}/lines/${lineNumber}`);
    return response.data;
  }

  // File upload
  async uploadFile(file: File, channelId?: string): Promise<ApiResponse<{ url: string; filename: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    if (channelId) formData.append('channelId', channelId);

    const response: AxiosResponse<ApiResponse<{ url: string; filename: string }>> = await this.api.post(
      '/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  // Utility methods
  setAuthToken(token: string): void {
    localStorage.setItem('authToken', token);
  }

  removeAuthToken(): void {
    localStorage.removeItem('authToken');
  }

  getAuthToken(): string | null {
    return localStorage.getItem('authToken');
  }
}

// Create and export a single instance
console.log('🔧 Creating ApiService instance...');
const apiService = new ApiService();
console.log('🔧 ApiService instance created:', !!apiService);
export { apiService };
export default apiService;