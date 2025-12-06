// src/types/messages.ts
import type { Bookmark } from "../core/bookmark";

// ADD_BOOKMARK from content script
export type AddBookmarkMessage = {
    type: "ADD_BOOKMARK";
    payload: {
        time: number;
        title: string;
        channel: string;
        desc?: string;
        videoId?: string; // content usually passes this, but background can also derive it
    };
};

// GET_BOOKMARKS_FOR_VIDEO from popup
export type GetBookmarksForVideoMessage = {
    type: "GET_BOOKMARKS_FOR_VIDEO";
    videoId: string;
};

// UPDATE_BOOKMARK from popup
export type UpdateBookmarkMessage = {
    type: "UPDATE_BOOKMARK";
    bookmark: Bookmark;
};

// DELETE_BOOKMARK from popup
export type DeleteBookmarkMessage = {
    type: "DELETE_BOOKMARK";
    videoId: string;
    bookmarkId: string;
};

// GET_ALL_VIDEOS (future dashboard)
export type GetAllVideosMessage = {
    type: "GET_ALL_VIDEOS";
};

export type BackgroundMessage =
    | AddBookmarkMessage
    | GetBookmarksForVideoMessage
    | UpdateBookmarkMessage
    | DeleteBookmarkMessage
    | GetAllVideosMessage;
