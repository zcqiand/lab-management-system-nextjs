import { BackendSwitcher } from "@/components/app/backend-switcher";
import { LoginForm } from "@/components/app/login-form";

export default function Page() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6 font-mono text-sm">
      <h1 className="text-xl">lab-management-system-nextjs</h1>
      <p className="text-xs text-gray-500">
        4-backend 切换：MSW / ASP.NET Core / Spring Boot / Next.js API（同源本仓）。
      </p>
      <BackendSwitcher />
      <div className="border-t pt-4">
        <h2 className="text-base mb-2">登录</h2>
        <LoginForm />
      </div>
    </main>
  );
}
