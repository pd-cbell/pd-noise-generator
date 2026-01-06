import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { Shield, Loader2, User as UserIcon } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
  agentEnabled?: boolean;
  createdAt: string;
}

export const AdminDashboard: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [updatingAgentId, setUpdatingAgentId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    setNotice(null);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId);
    setNotice(null);
    try {
      const updatedUser = await api.updateUserRole(userId, newRole);
      setUsers(users.map(u => u.id === userId ? { ...u, role: updatedUser.role } : u));
      setNotice('Role updated.');
    } catch (err: any) {
      console.error('Failed to update role', err);
      setError(err.message || 'Failed to update role');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleAgentToggle = async (userId: string, agentEnabled: boolean) => {
    setUpdatingAgentId(userId);
    setNotice(null);
    try {
      const updatedUser = await api.updateUserAgentEnabled(userId, agentEnabled);
      setUsers(users.map(u => u.id === userId ? { ...u, agentEnabled: updatedUser.agentEnabled } : u));
      setNotice('Agent access updated.');
    } catch (err: any) {
      console.error('Failed to update agent access', err);
      setError(err.message || 'Failed to update agent access');
    } finally {
      setUpdatingAgentId(null);
    }
  };

  if (isLoading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading users...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Shield className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-500">Manage users and permissions</p>
          </div>
        </div>
        <button 
          onClick={fetchUsers} 
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Refresh List
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {notice}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      {user.avatarUrl ? (
                        <img className="h-10 w-10 rounded-full" src={user.avatarUrl} alt="" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <UserIcon className="h-6 w-6 text-gray-500" />
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.name || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">ID: {user.id.substring(0, 8)}...</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <select
                    disabled={updatingUserId === user.id || user.id === currentUser?.id}
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className={`
                      block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md
                      ${updatingUserId === user.id || user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {Object.values(UserRole).map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  {user.id === currentUser?.id && (
                    <div className="mt-1 text-xs text-gray-400">Self role edits disabled</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(user.agentEnabled)}
                      disabled={updatingAgentId === user.id}
                      onChange={(e) => handleAgentToggle(user.id, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-600">
                      {user.agentEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
