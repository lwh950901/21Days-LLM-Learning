import "./globals.css";

export const metadata = {
  title: "Module 3 Workflow Console",
  description: "Workflow, Agent, LangGraph and Multi-Agent learning demo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
