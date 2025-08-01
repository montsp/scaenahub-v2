import React, { useState, useEffect } from 'react';
import { Script, User, Role } from '../../types';
import { apiService } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import {
  UserGroupIcon,
  EyeIcon,
  PencilIcon,
  XMarkIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

interface ScriptPermissionsProps {
  script: Script;
  onClose: () => void;
  onPermissionsUpdate: () => void;
}

interface Permission {
  id: string;
  type: 'user' | 'role';
  targetId: string;
  targetName: string;
  permission: 'read' | 'write';
}

const ScriptPermissions: React.FC<ScriptPermissionsProps> = ({
  script,
  onClose,
  onPermissionsUpdate,
}) => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPermission, setNewPermission] = useState({
    type: 'user' as 'user' | 'role',
    targetId: '',
    permission: 'read' as 'read' | 'write',
  });

  const {
    data: permissionsData,
    loading: permissionsLoading,
    execute: fetchPermissions,
  } = useApi(apiService.getScriptPermissions);

  const {
    data: usersData,
    execute: fetchUsers,
  } = useApi(apiService.getUsers);

  const {
    data: rolesData,
    execute: fetchRoles,
  } = useApi(apiService.getRoles);

  const {
    execute: addPermission,
    loading: addLoading,
  } = useApi(apiService.addScriptPermission);

  const {
    execute: removePermission,
    loading: removeLoading,
  } = useApi(apiService.removeScriptPermission);

  useEffect(() => {
    fetchPermissions(script.id);
    fetchUsers();
    fetchRoles();
  }, [script.id, fetchPermissions, fetchUsers, fetchRoles]);

  useEffect(() => {
    if (permissionsData) {
      setPermissions(permissionsData);
    }
  }, [permissionsData]);

  useEffect(() => {
    if (usersData) {
      setUsers(Array.isArray(usersData) ? usersData : usersData.users || []);
    }
  }, [usersData]);

  useEffect(() => {
    if (rolesData) {
      setRoles(Array.isArray(rolesData) ? rolesData : rolesData.roles || []);
    }
  }, [rolesData]);

  const handleAddPermission = async () => {
    if (!newPermission.targetId) return;

    try {
      const result = await addPermission({
        scriptId: script.id,
        type: newPermission.type,
        targetId: newPermission.targetId,
        permission: newPermission.permission,
      });

      if (result) {
        setPermissions(prev => [...prev, result]);
        setNewPermission({
          type: 'user',
          targetId: '',
          permission: 'read',
        });
        setShowAddForm(false);
        onPermissionsUpdate();
      }
    } catch (error) {
      console.error('Failed to add permission:', error);
    }
  };

  const handleRemovePermission = async (permissionId: string) => {
    try {
      await removePermission(permissionId);
      setPermissions(prev => prev.filter(p => p.id !== permissionId));
      onPermissionsUpdate();
    } catch (error) {
      console.error('Failed to remove permission:', error);
    }
  };

  const getTargetOptions = () => {
    if (newPermission.type === 'user') {
      return users.map(user => ({
        id: user.id,
        name: user.profile?.displayName || user.username,
      }));
    } else {
      return roles.map(role => ({
        id: role.id,
        name: role.name,
      }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <UserGroupIcon className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">脚本権限設定</h2>
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
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Current Permissions */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">現在の権限</h3>
            
            {permissionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : permissions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <UserGroupIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">権限が設定されていません</p>
                <p className="text-xs text-gray-400 mt-1">管理者のみがアクセス可能です</p>
              </div>
            ) : (
              <div className="space-y-2">
                {permissions.map((permission) => (
                  <div
                    key={permission.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {permission.type === 'user' ? (
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-blue-600">
                              {permission.targetName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                            <UserGroupIcon className="h-4 w-4 text-purple-600" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {permission.targetName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {permission.type === 'user' ? 'ユーザー' : 'ロール'}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        {permission.permission === 'read' ? (
                          <EyeIcon className="h-4 w-4 text-green-600" />
                        ) : (
                          <PencilIcon className="h-4 w-4 text-blue-600" />
                        )}
                        <span className="text-sm text-gray-600">
                          {permission.permission === 'read' ? '閲覧' : '編集'}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => handleRemovePermission(permission.id)}
                        disabled={removeLoading}
                        className="p-1 text-red-400 hover:text-red-600 rounded transition-colors duration-200"
                        title="権限を削除"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Permission Form */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">権限を追加</h3>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>追加</span>
                </button>
              )}
            </div>

            {showAddForm && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                {/* Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    対象タイプ
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="user"
                        checked={newPermission.type === 'user'}
                        onChange={(e) => setNewPermission(prev => ({ 
                          ...prev, 
                          type: e.target.value as 'user' | 'role',
                          targetId: ''
                        }))}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">ユーザー</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="role"
                        checked={newPermission.type === 'role'}
                        onChange={(e) => setNewPermission(prev => ({ 
                          ...prev, 
                          type: e.target.value as 'user' | 'role',
                          targetId: ''
                        }))}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">ロール</span>
                    </label>
                  </div>
                </div>

                {/* Target Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {newPermission.type === 'user' ? 'ユーザー' : 'ロール'}を選択
                  </label>
                  <select
                    value={newPermission.targetId}
                    onChange={(e) => setNewPermission(prev => ({ ...prev, targetId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">選択してください</option>
                    {getTargetOptions().map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Permission Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    権限レベル
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="read"
                        checked={newPermission.permission === 'read'}
                        onChange={(e) => setNewPermission(prev => ({ 
                          ...prev, 
                          permission: e.target.value as 'read' | 'write'
                        }))}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">閲覧のみ</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="write"
                        checked={newPermission.permission === 'write'}
                        onChange={(e) => setNewPermission(prev => ({ 
                          ...prev, 
                          permission: e.target.value as 'read' | 'write'
                        }))}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">編集可能</span>
                    </label>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2 pt-2">
                  <button
                    onClick={handleAddPermission}
                    disabled={!newPermission.targetId || addLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {addLoading ? '追加中...' : '追加'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewPermission({
                        type: 'user',
                        targetId: '',
                        permission: 'read',
                      });
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptPermissions;