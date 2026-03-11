'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';

interface KlineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface KlineChartProps {
  code: string;
}

export function KlineChart({ code }: KlineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [isClient, setIsClient] = useState(false);
  
  const { data: klineData, isLoading } = useSWR<KlineData[]>(
    `/v1/market/kline/${code}?count=60`,
    fetcher,
  );
  
  // 确保只在客户端运行
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (!isClient || !chartContainerRef.current || !klineData?.length) return;
    
    // 动态导入 lightweight-charts
    import('lightweight-charts').then(({ createChart, ColorType }) => {
      // 销毁旧图表
      if (chartRef.current) {
        chartRef.current.remove();
      }
      
      // 创建新图表 - 深色主题
      const chart = createChart(chartContainerRef.current!, {
        layout: {
          background: { type: ColorType.Solid, color: '#1c2128' },
          textColor: '#e6edf3',
        },
        width: chartContainerRef.current!.clientWidth,
        height: 400,
        grid: {
          vertLines: { color: '#30363d' },
          horzLines: { color: '#30363d' },
        },
        timeScale: {
          timeVisible: false,
          borderColor: '#30363d',
        },
        rightPriceScale: {
          borderColor: '#30363d',
        },
      });
      
      chartRef.current = chart;
      
      // K 线系列 - A股风格：红涨绿跌
      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#ef4444',      // 红涨
        downColor: '#22c55e',    // 绿跌
        borderUpColor: '#ef4444',
        borderDownColor: '#22c55e',
        wickUpColor: '#ef4444',
        wickDownColor: '#22c55e',
      });
      
      // 转换数据格式
      const chartData = klineData.map(item => ({
        time: item.date,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }));
      
      candlestickSeries.setData(chartData as any);
      
      // 自适应宽度
      const handleResize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      // 缩放到适合
      chart.timeScale().fitContent();
      
      // 清理
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    });
    
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [isClient, klineData]);
  
  if (isLoading || !isClient) {
    return (
      <div className="card p-4">
        <h3 className="font-semibold mb-3">📊 K 线图</h3>
        <div className="h-[400px] flex items-center justify-center text-[var(--text-muted)]">
          加载中...
        </div>
      </div>
    );
  }
  
  if (!klineData?.length) {
    return (
      <div className="card p-4">
        <h3 className="font-semibold mb-3">📊 K 线图</h3>
        <div className="h-[400px] flex items-center justify-center text-[var(--text-muted)]">
          暂无数据
        </div>
      </div>
    );
  }
  
  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-3">📊 K 线图 (日线)</h3>
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
