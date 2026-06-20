import { Suspense, type ReactNode } from "react";

import { AdminNavigationProgress } from "@/app/components/admin-navigation-progress";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense>
        <AdminNavigationProgress />
      </Suspense>
      {children}
    </>
  );
}
