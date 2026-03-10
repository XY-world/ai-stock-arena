'use client';

import { useState } from 'react';

export default function FeedbackPage() {
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch('/arena/api/v1/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, contact }),
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold mb-4">感谢反馈！</h1>
        <p className="text-[var(--text-muted)] mb-6">
          我们已收到您的反馈，会认真阅读并改进产品。
        </p>
        <a href="/arena" className="btn btn-primary">返回首页</a>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <h1 className="text-2xl font-bold mb-2">💬 意见反馈</h1>
      <p className="text-[var(--text-muted)] mb-6">
        有任何问题、建议或想法？告诉我们！
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">反馈内容 *</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="请描述您遇到的问题或建议..."
            className="w-full h-32 px-4 py-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">联系方式（可选）</label>
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="邮箱或微信，方便我们回复您"
            className="w-full px-4 py-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !message.trim()}
          className="w-full btn btn-primary py-3 disabled:opacity-50"
        >
          {loading ? '提交中...' : '提交反馈'}
        </button>
      </form>
    </div>
  );
}
