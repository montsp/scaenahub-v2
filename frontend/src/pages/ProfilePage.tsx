import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { UserCircleIcon, CameraIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { UserProfile } from '../types';

const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    displayName: user?.profile?.displayName || '',
    bio: '',
    avatar: '',
    onlineStatus: 'online' as UserProfile['onlineStatus'],
    customStatus: '',
    customStatusEmoji: '',
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (user) {
      // Load user profile data
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;
    
    try {
      const response = await apiService.getUserProfile(user.id);
      if (response.success && response.data) {
        const profile = response.data;
        setFormData({
          displayName: profile.displayName || user.profile?.displayName,
          bio: profile.bio || '',
          avatar: profile.avatarUrl || '',
          onlineStatus: profile.onlineStatus,
          customStatus: profile.customStatus || '',
          customStatusEmoji: profile.customStatusEmoji || '',
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear field error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Clear messages
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    // Display name validation
    if (!formData.displayName.trim()) {
      errors.displayName = 'Display name is required';
    } else if (formData.displayName.length < 2) {
      errors.displayName = 'Display name must be at least 2 characters';
    } else if (formData.displayName.length > 100) {
      errors.displayName = 'Display name must be less than 100 characters';
    }

    // Bio validation
    if (formData.bio && formData.bio.length > 500) {
      errors.bio = 'Bio must be less than 500 characters';
    }

    // Custom status validation
    if (formData.customStatus && formData.customStatus.length > 100) {
      errors.customStatus = 'Custom status must be less than 100 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Update user profile
      const profileData = {
        displayName: formData.displayName,
        bio: formData.bio || undefined,
        avatarUrl: formData.avatar || undefined,
        onlineStatus: formData.onlineStatus,
        customStatus: formData.customStatus || undefined,
        customStatusEmoji: formData.customStatusEmoji || undefined,
      };

      const response = await apiService.updateUserProfile(profileData);
      
      if (response.success) {
        // Update auth context
        updateUser({
          profile: { 
            id: user?.profile?.id || '',
            userId: user?.profile?.userId || user?.id || '',
            displayName: formData.displayName,
            bio: user?.profile?.bio,
            avatarUrl: user?.profile?.avatarUrl,
            onlineStatus: user?.profile?.onlineStatus || 'offline',
            customStatus: user?.profile?.customStatus,
            customStatusEmoji: user?.profile?.customStatusEmoji,
            customStatusExpiresAt: user?.profile?.customStatusExpiresAt,
            createdAt: user?.profile?.createdAt || new Date(),
            updatedAt: new Date()
          },
        });
        
        setSuccess('Profile updated successfully!');
        
        // Update online status separately if changed
        if (formData.onlineStatus !== user?.profile?.onlineStatus) {
          await apiService.updateOnlineStatus(formData.onlineStatus);
        }
        
        // Set custom status if provided
        if (formData.customStatus) {
          await apiService.setCustomStatus(
            formData.customStatus,
            formData.customStatusEmoji || undefined
          );
        }
      } else {
        throw new Error(response.message || 'Failed to update profile');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update profile';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const onlineStatusOptions = [
    { value: 'online', label: 'オンライン', color: 'text-green-600', bgColor: 'bg-green-100' },
    { value: 'away', label: '離席中', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    { value: 'busy', label: '取り込み中', color: 'text-red-600', bgColor: 'bg-red-100' },
    { value: 'offline', label: 'オフライン', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  ];

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-secondary-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-secondary-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-secondary-200">
          <h1 className="text-2xl font-bold text-secondary-900">プロフィール設定</h1>
          <p className="text-sm text-secondary-600 mt-1">
            あなたの情報を編集できます
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Success/Error Messages */}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm animate-fade-in">
              <div className="flex items-center">
                <CheckIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                {success}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm animate-fade-in">
              <div className="flex items-center">
                <XMarkIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                {error}
              </div>
            </div>
          )}

          {/* Avatar Section */}
          <div className="flex items-center space-x-6">
            <div className="relative">
              {formData.avatar ? (
                <img
                  src={formData.avatar}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover border-2 border-secondary-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-secondary-100 flex items-center justify-center border-2 border-secondary-200">
                  <UserCircleIcon className="w-12 h-12 text-secondary-400" />
                </div>
              )}
              <button
                type="button"
                className="absolute bottom-0 right-0 bg-primary-600 text-white rounded-full p-1.5 hover:bg-primary-700 transition-colors duration-200"
                onClick={() => {
                  // TODO: Implement avatar upload
                  alert('Avatar upload feature will be implemented later');
                }}
              >
                <CameraIcon className="w-4 h-4" />
              </button>
            </div>
            <div>
              <h3 className="text-lg font-medium text-secondary-900">{user.profile?.displayName}</h3>
              <p className="text-sm text-secondary-600">@{user.username}</p>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-secondary-700 mb-1">
              表示名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleInputChange}
              className={`input-field ${formErrors.displayName ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
              placeholder="表示名を入力"
              disabled={isLoading}
              maxLength={100}
            />
            {formErrors.displayName && (
              <p className="mt-1 text-sm text-red-600">{formErrors.displayName}</p>
            )}
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-secondary-700 mb-1">
              自己紹介
            </label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              rows={4}
              className={`input-field resize-none ${formErrors.bio ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
              placeholder="自己紹介を入力してください..."
              disabled={isLoading}
              maxLength={500}
            />
            <div className="flex justify-between items-center mt-1">
              {formErrors.bio && (
                <p className="text-sm text-red-600">{formErrors.bio}</p>
              )}
              <p className="text-xs text-secondary-500 ml-auto">
                {formData.bio.length}/500
              </p>
            </div>
          </div>

          {/* Online Status */}
          <div>
            <label htmlFor="onlineStatus" className="block text-sm font-medium text-secondary-700 mb-1">
              オンラインステータス
            </label>
            <select
              id="onlineStatus"
              name="onlineStatus"
              value={formData.onlineStatus}
              onChange={handleInputChange}
              className="input-field"
              disabled={isLoading}
            >
              {onlineStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="customStatus" className="block text-sm font-medium text-secondary-700 mb-1">
                カスタムステータス
              </label>
              <input
                type="text"
                id="customStatus"
                name="customStatus"
                value={formData.customStatus}
                onChange={handleInputChange}
                className={`input-field ${formErrors.customStatus ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                placeholder="今何をしていますか？"
                disabled={isLoading}
                maxLength={100}
              />
              {formErrors.customStatus && (
                <p className="mt-1 text-sm text-red-600">{formErrors.customStatus}</p>
              )}
            </div>
            <div>
              <label htmlFor="customStatusEmoji" className="block text-sm font-medium text-secondary-700 mb-1">
                絵文字
              </label>
              <input
                type="text"
                id="customStatusEmoji"
                name="customStatusEmoji"
                value={formData.customStatusEmoji}
                onChange={handleInputChange}
                className="input-field text-center"
                placeholder="😊"
                disabled={isLoading}
                maxLength={2}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isLoading || Object.keys(formErrors).some(key => formErrors[key])}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center min-h-[44px] px-6"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  更新中...
                </>
              ) : (
                '変更を保存'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;