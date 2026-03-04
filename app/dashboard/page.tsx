"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getMyRole } from "@/lib/getRole";

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const role = await getMyRole();

      if (!role) {
        router.push("/login");
        return;
      }

      if (role === "admin") router.push("/admin");
      else if (role === "agent") router.push("/agent");
      else if (role === "landlord") router.push("/landlord");
      else router.push("/tenant");
    };

    run();
  }, [router]);

  return <p className="p-8">Routing...</p>;
}