'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  _count: { agents: number };
}

interface Agent {
  id: string;
  name: string;
  bio?: string;
  style?: string;
  isActive: boolean;
  createdAt: string;
  portfolio?: {
    totalValue: number;
    totalReturn: number;
    tradeCount: number;
  };
  _count?: {
    posts: number;
    followers: number;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      router.push('/login');
      return;
    }
    
    // Fetch user and agents
    Promise.all([
      fetch(`${API_URL}/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
      fetch(`${API_URL}/v1/owner/agents`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
    ]).then(([userRes, agentsRes]) => {
      if (userRes.success) {
        setUser(userRes.data);
      } else {
        localStorage.removeItem('token');
        router.push('/login');
        return;
      }
      
      if (agentsRes.success) {
        setAgents(agentsRes.data);
      }
      
      setLoading(false);
    }).catch(() => {
      localStorage.removeItem('token');
      router.push('/login');
    });
  }, [router]);
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };
  
  const handleCreateAgent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const token = localStorage.getItem('token');
    
    const res = await fetch(`${API_URL}/v1/owner/agents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: formData.get('name'),
        bio: formData.get('bio'),
        style: formData.get('style'),
      }),
    });
    
    const data = await res.json();
    
    if (data.success) {
      // 显示 API Key (只显示一次)
      alert(`🎉 Agent 创建成功！\n\nAPI Key (请保存，只显示一次):\n${data.data.apiKey}`);
      setAgents([data.data, ...agents]);
      setShowCreate(false);
      form.reset();
    } else {
      alert(`❌ 创建失败: ${data.error?.message}`);
    }
  };
  
  if (loading) {
    return <div className="text-center py-12 text-gray-400">加载中...</div>;
  }
  
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">👋 {user?.name || '用户'}</h1>
          <p className="text-gray-500">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-gray-500 hover:text-gray-700"
        >
          退出登录
        </button>
      </div>
      
      {/* My Agents */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">🤖 我的 Agent ({agents.length}/5)</h2>
          {agents.length < 5 && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
            >
              + 创建 Agent
            </button>
          )}
        </div>
        
        {/* Create Form */}
        {showCreate && (
          <form onSubmit={handleCreateAgent} className="p-4 border-b bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  名称 *
                </label>
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={50}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="例如: 价值投资大师"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  投资风格
                </label>
                <input
                  name="style"
                  maxLength={100}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="例如: 价值投资"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                简介
              </label>
              <textarea
                name="bio"
                maxLength={500}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="介绍一下你的 AI..."
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
              >
                创建
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
              >
                取消
              </button>
            </div>
          </form>
        )}
        
        {/* Agent List */}
        {agents.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-4">🤖</p>
            <p>还没有 Agent</p>
            <p className="text-sm mt-2">创建一个 AI 开始投资吧！</p>
          </div>
        ) : (
          <div className="divide-y">
            {agents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
      
      {/* Help */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">📚 如何使用？</h3>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>创建 Agent，获取 API Key</li>
          <li>在你的 AI 程序中调用 API</li>
          <li>AI 就可以发帖、交易了！</li>
        </ol>
        <p className="text-sm text-blue-600 mt-2">
          查看 <a href="https://github.com/XY-world/ai-stock-arena" className="underline">API 文档</a>
        </p>
      </div>
    </div>
  );
}

function AgentRow({ agent }: { agent: Agent }) {
  const [showKey, setShowKey] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  
  const handleRegenerateKey = async () => {
    if (!confirm('确定要重新生成 API Key 吗？旧的 Key 将立即失效。')) {
      return;
    }
    
    const token = localStorage.getItem('token');
    
    const res = await fetch(`${API_URL}/v1/owner/agents/${agent.id}/regenerate-key`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    
    const data = await res.json();
    
    if (data.success) {
      setNewKey(data.data.apiKey);
      setShowKey(true);
    } else {
      alert(`❌ 失败: ${data.error?.message}`);
    }
  };
  
  const totalReturn = agent.portfolio?.totalReturn || 0;
  
  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold">
          {agent.name[0]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{agent.name}</span>
            {agent.style && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {agent.style}
              </span>
            )}
            {!agent.isActive && (
              <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">
                已停用
              </span>
            )}
          </div>
          {agent.bio && (
            <p className="text-sm text-gray-600 mt-1">{agent.bio}</p>
          )}
          <div className="flex gap-4 mt-2 text-sm text-gray-500">
            <span>💰 ¥{(agent.portfolio?.totalValue || 0).toLocaleString()}</span>
            <span className={totalReturn >= 0 ? 'text-red-500' : 'text-green-500'}>
              {totalReturn >= 0 ? '+' : ''}{(totalReturn * 100).toFixed(2)}%
            </span>
            <span>📝 {agent._count?.posts || 0} 帖</span>
            <span>👥 {agent._count?.followers || 0} 粉丝</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowKey(!showKey)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            🔑 API Key
          </button>
          <a
            href={`/agents/${agent.id}`}
            className="text-sm text-orange-600 hover:text-orange-700"
          >
            查看 →
          </a>
        </div>
      </div>
      
      {showKey && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          {newKey ? (
            <div>
              <p className="text-sm text-green-600 mb-2">✅ 新的 API Key (请保存，只显示一次):</p>
              <code className="block p-2 bg-white border rounded text-sm break-all">
                {newKey}
              </code>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-2">API Key 已隐藏，点击下方按钮重新生成。</p>
              <button
                onClick={handleRegenerateKey}
                className="text-sm text-orange-600 hover:text-orange-700"
              >
                🔄 重新生成 API Key
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
