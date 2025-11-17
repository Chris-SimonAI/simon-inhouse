'use client';

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export type OrderCardProps = {
  id: number;
  createdAt: Date | string;
  orderStatus: string;
  roomNumber: string;
  totalAmount: string;
  restaurantName: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  errorReason?: string | null;
  trackingUrl?: string | null;
  items?: Array<{
    itemName: string;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
  }>;
};

function LocalTime({ value }: { value: Date | string }) {
  const [text, setText] = useState<string>("");
  useEffect(() => {
    const d = typeof value === "string" ? new Date(value) : value;
    setText(d.toLocaleString());
  }, [value]);
  return <>{text}</>;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "pending":
      return "secondary";
    case "confirmed":
      return "default";
    case "delivered":
      return "outline";
    case "cancelled":
    case "failed":
    case "toast_ok_capture_failed":
      return "destructive";
    default:
      return "secondary";
  }
}

export default function OrderCard(props: OrderCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base">Order #{props.id}</CardTitle>
          <CardDescription>
            Placed <LocalTime value={props.createdAt} />
          </CardDescription>
        </div>
        <Badge variant={statusVariant(props.orderStatus)} className="capitalize">
          {props.orderStatus.replaceAll("_", " ")}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm break-words">
          <div className="text-muted-foreground">Restaurant</div>
          <div>{props.restaurantName ?? "—"}</div>

          <div className="text-muted-foreground">Room</div>
          <div>{props.roomNumber}</div>

          <div className="text-muted-foreground">Total</div>
          <div>${props.totalAmount}</div>

          <div className="text-muted-foreground">Email</div>
          <div>{props.contactEmail ?? "—"}</div>

          <div className="text-muted-foreground">Phone</div>
          <div>{props.contactPhone ?? "—"}</div>

          {props.trackingUrl ? (
            <>
              <div className="text-muted-foreground">Order Tracking URL</div>
              <div>{props.trackingUrl ?? "—"}</div>
            </>
          ) : null}

          {props.errorReason ? (
            <>
              <div className="text-muted-foreground">Error Reason</div>
              <div>{props.errorReason.length > 100 ? props.errorReason.slice(0, 100) + "..." : props.errorReason}</div>
            </>
          ) : null}
        </div>

        {props.items && props.items.length > 0 ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">Items</div>
            <ul className="space-y-1 text-sm">
              {props.items.map((it, idx) => (
                <li key={idx} className="flex items-start justify-between gap-3 break-words">
                  <span className="text-foreground">
                    {it.quantity} × {it.itemName}
                  </span>
                  <span className="text-muted-foreground whitespace-nowrap">
                    ${it.totalPrice}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}


