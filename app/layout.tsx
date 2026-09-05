import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '弹弹奇旅 · 把快乐发射出去',
  description: '原创天空浮岛弹射对战游戏，支持人机、训练和同屏双人。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
      </body>
    </html>
  );
}
