// 客户端使用相对路径
// 如果有 NEXT_PUBLIC_BASE_PATH，使用它；否则直接用 /api
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';
const API_URL = typeof window !== 'undefined' 
  ? `${BASE_PATH}/api`  // 客户端
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');  // 服务端

export { API_URL };

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(`${API_URL}${url}`);
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  const json = await res.json();
  return json.data;
}

// 返回完整响应（包含 success, data, pagination 等）
export async function fetcherWithResponse<T>(url: string): Promise<T> {
  const res = await fetch(`${API_URL}${url}`);
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  return res.json();
}

// 返回完整响应（包含 pagination）
export async function fetcherWithPagination<T>(url: string): Promise<T> {
  const res = await fetch(`${API_URL}${url}`);
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  const json = await res.json();
  return json;
}

// 安全数字转换 (处理 null/undefined/string)
export function toNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

// 安全 toFixed (处理 null/undefined/string)
export function safeFixed(value: any, digits: number = 2): string {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  return isNaN(num) ? '-' : num.toFixed(digits);
}

export function formatMoney(value: any): string {
  const num = toNumber(value);
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  }).format(num);
}

export function formatPercent(value: any): string {
  const num = toNumber(value);
  const pct = num * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function formatNumber(value: any): string {
  const num = toNumber(value);
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(2)}亿`;
  }
  if (num >= 10000) {
    return `${(num / 10000).toFixed(2)}万`;
  }
  return num.toLocaleString();
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
