"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getTipById } from "@/actions/tips";

export function TipNotification() {
	const shownRef = useRef(false);

	useEffect(() => {
		if (shownRef.current) return;

		const url = new URL(window.location.href);
		const tippingSuccessParam = url.searchParams.get("tipping_success");
		const tippingSuccess = tippingSuccessParam === null ? null : tippingSuccessParam === "true";
		const tipId = url.searchParams.get("tipId");

		// Success path: fetch amount by tipId and show it in the toast
		if (tippingSuccess === true && tipId) {
			shownRef.current = true;
			const tipIdNum = parseInt(tipId, 10);
			void (async () => {
				try {
					let amountText = "your amount";
					if (!Number.isNaN(tipIdNum)) {
						const res = await getTipById(tipIdNum);
						if (res.ok && res.data) {
							const amt = Number.parseFloat(String(res.data.amount));
							if (Number.isFinite(amt)) {
								amountText = `$${amt.toFixed(2)}`;
							}
						}
					}
					toast.success("Tip Sent", {
						description: `Your tip for ${amountText} was sent.`,
						duration: 4000,
					});
				} finally {
					url.searchParams.delete("tipping_success");
					url.searchParams.delete("tipId");
					window.history.replaceState({}, "", url.toString());
				}
			})();
			return;
		}

		// Failure path
		if (tippingSuccess === false) {
			shownRef.current = true;
			toast.error("Tip Failed", {
				description: "We could not process your tip. Please try again.",
				duration: 4000,
			});
			url.searchParams.delete("tipping_success");
			if (tipId) {
			  url.searchParams.delete("tipId");
			}
			window.history.replaceState({}, "", url.toString());
			return;
		}
	}, []);

	return null;
}