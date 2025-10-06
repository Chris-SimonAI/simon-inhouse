import { betterAuth, BetterAuthOptions } from "better-auth";
import { db } from "@/db";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, customSession } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { session, user, account, verification } from "@/db/schemas/index";

// const isProd = env.NODE_ENV === "production";
// Since https is not working in production, we need to set it to false
const isProd = false;

const options = {
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      session,
      user,
      account,
      verification,
    },
  }),

  session: {
    additionalFields: {
      hotelId: { type: "string", input: false },
      qrId:    { type: "string", input: false },
      threadId:{ type: "string", input: false },
      qrCode:  { type: "string", input: false },
    },
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  advanced: {
    useSecureCookies: isProd,
    defaultCookieAttributes: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",  
      path: "/",
    },

    cookies: {
      session_token: {
        name: "better-auth.session_token",
        attributes: {
          httpOnly: true,
          secure: isProd,
          sameSite: isProd ? "none" : "lax",
          path: "/",
        },
      },
      session_data: {
        name: "better-auth.session_data",
        attributes: {
          httpOnly: true,
          secure: isProd,
          sameSite: isProd ? "none" : "lax",
          path: "/",
        },
      },
    },
    cookiePrefix: "better-auth",
  },

  plugins: [
    anonymous(),
    nextCookies(),  
  ],
} satisfies BetterAuthOptions;

export const auth = betterAuth({
  ...options,
  plugins: [
    ...(options.plugins ?? []),
    customSession(
      async ({ user, session }) => {
        return {
          user,
          session: {
            ...session,
            hotelId: session.hotelId,
            qrId: session.qrId,
            threadId: session.threadId,
            qrCode: session.qrCode,
          }
        };
      },
      options 
    ),
  ],
});
