import { z } from "zod";

export const MenuMarkupInput = z.object({
	restaurantId: z.number().int().positive(),
	markupPercent: z
		.number()
		.min(0, { message: "markupPercent too low" })
		.max(1000, { message: "markupPercent too high" }),
});

export type MenuMarkupInput = z.infer<typeof MenuMarkupInput>;


