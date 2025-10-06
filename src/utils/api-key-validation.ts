import { env } from "@/env";

export const validateApiKey = (apiKey: string) => {
    if (!apiKey) {
        return false;
    }
    if (apiKey !== env.APP_API_KEY) {
        return false;
    }
    return true;
};