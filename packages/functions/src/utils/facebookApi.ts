/**
 * Facebook Graph API Utility
 * Manages posting and insights for the XIRI Facility Solutions Facebook Business Page.
 * Uses a never-expiring System User token stored in Secret Manager.
 */

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Page ID for XIRI Facility Solutions
const PAGE_ID = "946781681862472";

export interface FacebookPostResult {
    id: string;
    success: boolean;
    postUrl?: string;
    error?: string;
}

export interface FacebookPost {
    id: string;
    message?: string;
    created_time: string;
    full_picture?: string;
    permalink_url?: string;
    likes?: { summary: { total_count: number } };
    comments?: { summary: { total_count: number } };
    shares?: { count: number };
}

export interface FacebookInsights {
    page_impressions?: number;
    page_engaged_users?: number;
    page_fans?: number;
    page_post_engagements?: number;
}

/**
 * Get the Facebook Page Access Token from environment (set via Secret Manager)
 */
function getAccessToken(): string {
    const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    if (!token) {
        throw new Error("FACEBOOK_PAGE_ACCESS_TOKEN not found in environment.");
    }
    return token;
}

/**
 * Publish a text post to the Facebook Page
 */
export async function publishPost(
    message: string,
    link?: string,
    imageUrl?: string
): Promise<FacebookPostResult> {
    const token = getAccessToken();

    try {
        let endpoint = `${GRAPH_BASE_URL}/${PAGE_ID}/feed`;
        const body: Record<string, string> = {
            message,
            access_token: token,
        };

        if (link) {
            body.link = link;
        }

        // If image URL provided, use /photos endpoint instead
        if (imageUrl) {
            endpoint = `${GRAPH_BASE_URL}/${PAGE_ID}/photos`;
            body.url = imageUrl;
        }

        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (data.error) {
            console.error("Facebook API error:", data.error);
            return {
                id: "",
                success: false,
                error: data.error.message || "Unknown Facebook API error",
            };
        }

        const postId = data.id || data.post_id;
        return {
            id: postId,
            success: true,
            postUrl: `https://facebook.com/${postId}`,
        };
    } catch (error: any) {
        console.error("Facebook publish error:", error);
        return {
            id: "",
            success: false,
            error: error.message || "Failed to publish to Facebook",
        };
    }
}

/**
 * Schedule a post for future publication
 */
export async function schedulePost(
    message: string,
    scheduledTime: Date,
    link?: string
): Promise<FacebookPostResult> {
    const token = getAccessToken();

    // Facebook requires timestamps to be at least 10 minutes in the future
    // and at most 75 days out
    const unixTimestamp = Math.floor(scheduledTime.getTime() / 1000);

    try {
        const body: Record<string, string | number | boolean> = {
            message,
            access_token: token,
            published: false,
            scheduled_publish_time: unixTimestamp,
        };

        if (link) {
            body.link = link;
        }

        const response = await fetch(`${GRAPH_BASE_URL}/${PAGE_ID}/feed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (data.error) {
            console.error("Facebook schedule error:", data.error);
            return {
                id: "",
                success: false,
                error: data.error.message || "Failed to schedule post",
            };
        }

        return {
            id: data.id,
            success: true,
        };
    } catch (error: any) {
        console.error("Facebook schedule error:", error);
        return {
            id: "",
            success: false,
            error: error.message || "Failed to schedule post",
        };
    }
}

/**
 * Get recent posts from the page with engagement metrics
 */
export async function getRecentPosts(limit: number = 10): Promise<FacebookPost[]> {
    const token = getAccessToken();

    try {
        const fields = "id,message,created_time,full_picture,permalink_url,likes.summary(true),comments.summary(true),shares";
        const response = await fetch(
            `${GRAPH_BASE_URL}/${PAGE_ID}/feed?fields=${fields}&limit=${limit}&access_token=${token}`
        );

        const data = await response.json();

        if (data.error) {
            console.error("Facebook get posts error:", data.error);
            return [];
        }

        return data.data || [];
    } catch (error: any) {
        console.error("Facebook get posts error:", error);
        return [];
    }
}

/**
 * Get page insights for a given period
 */
export async function getPageInsights(
    period: "day" | "week" | "days_28" = "week"
): Promise<FacebookInsights> {
    const token = getAccessToken();

    try {
        const metrics = "page_impressions,page_engaged_users,page_fans,page_post_engagements";
        const response = await fetch(
            `${GRAPH_BASE_URL}/${PAGE_ID}/insights?metric=${metrics}&period=${period}&access_token=${token}`
        );

        const data = await response.json();

        if (data.error) {
            console.error("Facebook insights error:", data.error);
            return {};
        }

        const insights: FacebookInsights = {};
        for (const metric of data.data || []) {
            const key = metric.name as keyof FacebookInsights;
            const value = metric.values?.[0]?.value;
            if (value !== undefined) {
                insights[key] = value;
            }
        }

        return insights;
    } catch (error: any) {
        console.error("Facebook insights error:", error);
        return {};
    }
}

/**
 * Delete a post from the page
 */
export async function deletePost(postId: string): Promise<boolean> {
    const token = getAccessToken();

    try {
        const response = await fetch(
            `${GRAPH_BASE_URL}/${postId}?access_token=${token}`,
            { method: "DELETE" }
        );

        const data = await response.json();
        return data.success === true;
    } catch (error: any) {
        console.error("Facebook delete post error:", error);
        return false;
    }
}
