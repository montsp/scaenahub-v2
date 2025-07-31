import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  UserGroupIcon,
  ClockIcon,
  SparklesIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  const stats = [
    {
      name: 'Active Channels',
      value: '12',
      icon: ChatBubbleLeftRightIcon,
      change: '+2',
      changeType: 'positive' as const,
    },
    {
      name: 'Script Lines',
      value: '1,247',
      icon: DocumentTextIcon,
      change: '+89',
      changeType: 'positive' as const,
    },
    {
      name: 'Team Members',
      value: '60',
      icon: UserGroupIcon,
      change: '+3',
      changeType: 'positive' as const,
    },
    {
      name: 'Hours Worked',
      value: '156',
      icon: ClockIcon,
      change: '+12',
      changeType: 'positive' as const,
    },
  ];

  const recentActivity = [
    {
      id: 1,
      type: 'message',
      user: 'Yuki Tanaka',
      action: 'posted a message in',
      target: '#general',
      time: '2 minutes ago',
      avatar: 'YT',
    },
    {
      id: 2,
      type: 'script',
      user: 'Hiroshi Sato',
      action: 'updated script line in',
      target: 'Act 1 Scene 2',
      time: '5 minutes ago',
      avatar: 'HS',
    },
    {
      id: 3,
      type: 'member',
      user: 'Akiko Yamada',
      action: 'joined the project',
      target: '',
      time: '1 hour ago',
      avatar: 'AY',
    },
    {
      id: 4,
      type: 'channel',
      user: 'Kenji Nakamura',
      action: 'created channel',
      target: '#costume-design',
      time: '2 hours ago',
      avatar: 'KN',
    },
  ];

  const quickActions = [
    {
      name: 'New Message',
      description: 'Send a message to a channel',
      icon: ChatBubbleLeftRightIcon,
      action: () => console.log('New message'),
    },
    {
      name: 'Edit Script',
      description: 'Continue working on the script',
      icon: DocumentTextIcon,
      action: () => console.log('Edit script'),
    },
    {
      name: 'View Members',
      description: 'See who\'s online and their roles',
      icon: UserGroupIcon,
      action: () => console.log('View members'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="card card-body">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
            <SparklesIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.profile?.displayName || user?.username}!
            </h1>
            <p className="text-gray-600">
              Here's what's happening with your theater project today.
            </p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="card card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <div className="flex items-baseline">
                    <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                    <p className={`ml-2 text-sm font-medium ${
                      stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stat.change}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent activity */}
        <div className="card card-body">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <ArrowTrendingUpIcon className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-white">
                    {activity.avatar}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{activity.user}</span>{' '}
                    <span className="text-gray-600">{activity.action}</span>{' '}
                    {activity.target && (
                      <span className="font-medium text-blue-600">{activity.target}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="card card-body">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h2>
          <div className="space-y-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.name}
                  onClick={action.action}
                  className="w-full btn btn-outline text-left p-4 flex items-center space-x-4"
                >
                  <Icon className="h-6 w-6 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">{action.name}</p>
                    <p className="text-sm text-gray-600">{action.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Project progress */}
      <div className="card card-body">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Project Progress</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Script Completion</span>
              <span>78%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: '78%' }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Rehearsal Schedule</span>
              <span>45%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-600 h-2 rounded-full" style={{ width: '45%' }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Costume Design</span>
              <span>92%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full" style={{ width: '92%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;