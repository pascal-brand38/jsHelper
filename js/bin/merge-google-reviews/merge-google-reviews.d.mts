#!/usr/bin/env node
export interface googleReviewType {
    reviewer: {
        displayName: string;
    };
    starRating: string;
    comment?: string;
    createTime: string;
    updateTime: string;
    name: string;
}
export interface googleReviewsType {
    reviews: googleReviewType[];
}
export declare function mergeGoogleReviews(): Promise<void>;
