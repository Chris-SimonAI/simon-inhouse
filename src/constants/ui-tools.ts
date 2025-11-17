export const UI_TOOLS = {
    GET_AMENITIES: "tool-get_amenities",
    SEARCH_ATTRACTIONS: "tool-search_attractions",
    SEARCH_RESTAURANTS: "tool-search_restaurants",
    GET_DINE_IN_RESTAURANTS: "tool-get_dine_in_restaurants",
    GENERATION_STOPPED: "tool-generation_stopped",
} as const;

export type UiTool = (typeof UI_TOOLS)[keyof typeof UI_TOOLS];

export const ASSISTANT_TEXT_TYPES = {
    TEXT: "text",
} as const;

export type AssistantTextType = (typeof ASSISTANT_TEXT_TYPES)[keyof typeof ASSISTANT_TEXT_TYPES];

export const SCROLL_STOP_TYPES: (UiTool | AssistantTextType)[] = [
    UI_TOOLS.GET_AMENITIES,
    UI_TOOLS.SEARCH_ATTRACTIONS,
    UI_TOOLS.SEARCH_RESTAURANTS,
    ASSISTANT_TEXT_TYPES.TEXT,
    UI_TOOLS.GET_DINE_IN_RESTAURANTS,
];
