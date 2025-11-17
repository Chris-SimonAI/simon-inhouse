'use client';

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ORDER_FILTERS } from "@/constants/orders";

const FILTERS = ORDER_FILTERS;

export default function OrdersFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const ALL_VALUE = "all" as const;
  const current = (searchParams.get("status") ?? ALL_VALUE) as typeof FILTERS[number]["value"];

  const setStatus = useCallback((next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next !== ALL_VALUE) {
      params.set("status", next);
    } else {
      params.delete("status");
    }
    const query = params.toString();
    const target = query ? `${pathname}?${query}` : pathname;
    router.replace(target, { scroll: false });
  }, [router, pathname, searchParams]);

  const items = useMemo(() => FILTERS, []);

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-2">
        {items.map((f) => {
          const active = current === f.value;
          return (
            <Button
              key={f.value}
              type="button"
              variant={active ? "default" : "secondary"}
              size="sm"
              onClick={() => setStatus(f.value)}
              className="whitespace-nowrap"
            >
              {f.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}


