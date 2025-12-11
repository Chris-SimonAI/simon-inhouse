import { customSessionClient, inferAdditionalFields } from "better-auth/client/plugins";
import { nextCookies } from "better-auth/next-js";
import { anonymousClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { auth } from "./auth";

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_APP_URL,
    plugins: [anonymousClient(), 
        customSessionClient<typeof auth>(),
        inferAdditionalFields<typeof auth>(),
        nextCookies(),
    ],
});