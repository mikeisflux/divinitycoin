// app/partners/usage/page.tsx
// Partner usage analytics page

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface UsageData {
  overview: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    totalCardsIssued: number;
    totalVolume: number;
    averageResponseTime: number;
  };
  dailyUsage: Array<{
    date: string;
    requests: number;
    successful: number;
    failed: number;
    volume: number;
  }>;
  topEndpoints: Array<{
    endpoint: string;
    requests: number;
    avgResponseTime: number;
  }>;
  recentRequests: Array<{
    id: string;
    endpoint: string;
    method: string;
    status: number;
    responseTime: number;
    timestamp: string;
    ip: string;
  }>;
  errorBreakdown: Array<{
    code: number;
    message: string;
    count: number;
  }>;
}

export default function PartnerUsagePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');
  const [data, setData] = useState<UsageData | null>(null);

  useEffect(() => {
    fetchUsageData();
  }, [period]);

  const fetchUsageData = async () => {
    try {
      const response = await fetch(`/api/partners/usage?period=${period}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else if (response.status === 401) {
        router.push('/partners/login');
      }
    } catch (error) {
      console.error('Failed to fetch usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100);
  };

  const formatResponseTime = (ms: number) => {
    return `${ms.toFixed(0)}ms`;
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600 bg-green-100';
    if (status >= 400 && status < 500) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/partners/dashboard" className="text-neutral-500 hover:text-neutral-900">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-neutral-900">Usage Analytics</h1>
                <p className="text-sm text-neutral-500">Monitor your API usage and performance</p>
              </div>
            </div>

            {/* Period Selector */}
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Overview Cards */}
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <p className="text-sm text-neutral-500">Total Requests</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">
              {formatNumber(data?.overview.totalRequests || 0)}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-green-600 text-sm">
                {formatNumber(data?.overview.successfulRequests || 0)} successful
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <p className="text-sm text-neutral-500">Success Rate</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">
              {(data?.overview.successRate || 0).toFixed(1)}%
            </p>
            <div className="w-full bg-neutral-200 rounded-full h-2 mt-3">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${data?.overview.successRate || 0}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <p className="text-sm text-neutral-500">Cards Issued</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">
              {formatNumber(data?.overview.totalCardsIssued || 0)}
            </p>
            <p className="text-sm text-neutral-500 mt-2">
              Volume: {formatCurrency(data?.overview.totalVolume || 0)}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <p className="text-sm text-neutral-500">Avg Response Time</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">
              {formatResponseTime(data?.overview.averageResponseTime || 0)}
            </p>
            <p className="text-sm text-neutral-500 mt-2">Across all endpoints</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Daily Usage Chart */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="font-semibold text-neutral-900 mb-4">Daily API Usage</h2>
            <div className="h-64 flex items-end gap-1">
              {data?.dailyUsage.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col-reverse">
                    <div
                      className="w-full bg-green-500 rounded-t"
                      style={{
                        height: `${(day.successful / Math.max(...data.dailyUsage.map(d => d.requests), 1)) * 180}px`,
                      }}
                    ></div>
                    <div
                      className="w-full bg-red-400 rounded-t"
                      style={{
                        height: `${(day.failed / Math.max(...data.dailyUsage.map(d => d.requests), 1)) * 180}px`,
                      }}
                    ></div>
                  </div>
                  <span className="text-xs text-neutral-500 rotate-45 origin-left">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-neutral-200">
              <span className="flex items-center gap-2 text-sm text-neutral-600">
                <span className="w-3 h-3 bg-green-500 rounded"></span>
                Successful
              </span>
              <span className="flex items-center gap-2 text-sm text-neutral-600">
                <span className="w-3 h-3 bg-red-400 rounded"></span>
                Failed
              </span>
            </div>
          </div>

          {/* Top Endpoints */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="font-semibold text-neutral-900 mb-4">Top Endpoints</h2>
            <div className="space-y-4">
              {data?.topEndpoints.map((endpoint, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex-1">
                    <code className="text-sm text-neutral-900 font-mono">{endpoint.endpoint}</code>
                    <div className="w-full bg-neutral-200 rounded-full h-1.5 mt-2">
                      <div
                        className="bg-primary-500 h-1.5 rounded-full"
                        style={{
                          width: `${(endpoint.requests / Math.max(...(data?.topEndpoints.map(e => e.requests) || [1]))) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="text-sm font-medium text-neutral-900">{formatNumber(endpoint.requests)}</p>
                    <p className="text-xs text-neutral-500">{formatResponseTime(endpoint.avgResponseTime)}</p>
                  </div>
                </div>
              ))}
              {(!data?.topEndpoints || data.topEndpoints.length === 0) && (
                <p className="text-sm text-neutral-500 text-center py-8">No endpoint data yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Error Breakdown */}
        {data?.errorBreakdown && data.errorBreakdown.length > 0 && (
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="font-semibold text-neutral-900 mb-4">Error Breakdown</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {data.errorBreakdown.map((error, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
                  <span className={`px-2 py-1 rounded text-sm font-mono ${getStatusColor(error.code)}`}>
                    {error.code}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-neutral-900">{error.message}</p>
                    <p className="text-xs text-neutral-500">{formatNumber(error.count)} occurrences</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Requests */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h2 className="font-semibold text-neutral-900">Recent API Requests</h2>
          </div>

          {data?.recentRequests && data.recentRequests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Endpoint</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Response Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {data.recentRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4 text-sm text-neutral-500">
                        {new Date(req.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                          req.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                          req.method === 'POST' ? 'bg-green-100 text-green-700' :
                          req.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                          'bg-neutral-100 text-neutral-700'
                        }`}>
                          {req.method}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-neutral-900">{req.endpoint}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded ${getStatusColor(req.status)}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600">
                        {formatResponseTime(req.responseTime)}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-neutral-500">{req.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="text-neutral-500">No API requests yet. Start using the API to see usage data here.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
