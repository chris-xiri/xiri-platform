import * as logger from "firebase-functions/logger";

export const LEADS_CHAT_WEBHOOK =
    "https://chat.googleapis.com/v1/spaces/AAQAabO5T7o/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=P5qJXaSpDUHuM6WhEzzN8cSKILQ3qhrSitCBLZzxdDk";

export interface LeadChatNotificationParams {
    cardId: string;
    title: string;
    subtitle: string;
    fallbackText: string;
    businessName?: string;
    contactName?: string;
    contactRole?: string;
    email?: string;
    phone?: string;
    location?: string;
    facilityType?: string;
    squareFootage?: number | string | null;
    services?: string;
    source?: string;
    notes?: string;
    crmUrl?: string;
}

export async function sendLeadChatNotification(params: LeadChatNotificationParams): Promise<boolean> {
    const detailsWidgets: any[] = [];

    if (params.businessName) {
        detailsWidgets.push({
            decoratedText: {
                topLabel: "BUSINESS / FACILITY",
                text: params.businessName,
                startIcon: { knownIcon: "STORE" },
            },
        });
    }
    if (params.contactName) {
        detailsWidgets.push({
            decoratedText: {
                topLabel: "CONTACT",
                text: params.contactRole ? `${params.contactName} (${params.contactRole})` : params.contactName,
                startIcon: { knownIcon: "PERSON" },
            },
        });
    }
    if (params.email) {
        detailsWidgets.push({
            decoratedText: {
                topLabel: "EMAIL",
                text: params.email,
                startIcon: { knownIcon: "EMAIL" },
            },
        });
    }
    if (params.phone) {
        detailsWidgets.push({
            decoratedText: {
                topLabel: "PHONE",
                text: params.phone,
                startIcon: { knownIcon: "PHONE" },
            },
        });
    }
    if (params.location) {
        detailsWidgets.push({
            decoratedText: {
                topLabel: "LOCATION / ZIP",
                text: params.location,
                startIcon: { knownIcon: "MAP_PIN" },
            },
        });
    }

    const scopeLines = [
        params.facilityType ? `Facility Type: ${params.facilityType}` : "",
        params.squareFootage ? `Est. Sq Ft: ${typeof params.squareFootage === "number" ? params.squareFootage.toLocaleString("en-US") : params.squareFootage}` : "",
        params.services ? `Services: ${params.services}` : "",
        params.source ? `Source: ${params.source}` : "",
        params.notes ? `Notes: ${params.notes}` : "",
    ].filter(Boolean);

    const buttons: any[] = [];
    if (params.crmUrl) {
        buttons.push({
            text: "Open in Sales CRM",
            onClick: { openLink: { url: params.crmUrl } },
        });
    }
    if (params.email) {
        buttons.push({
            text: "Email Lead",
            onClick: { openLink: { url: `mailto:${params.email}` } },
        });
    }
    if (params.phone) {
        const digits = params.phone.replace(/\D/g, "");
        if (digits) {
            buttons.push({
                text: "Call Lead",
                onClick: { openLink: { url: `tel:${digits}` } },
            });
        }
    }

    const sections: any[] = [];
    if (detailsWidgets.length > 0) {
        sections.push({ widgets: detailsWidgets });
    }
    if (scopeLines.length > 0) {
        sections.push({
            header: "Lead Details",
            widgets: [
                {
                    textParagraph: {
                        text: scopeLines.join("<br/>"),
                    },
                },
            ],
        });
    }
    if (buttons.length > 0) {
        sections.push({
            widgets: [{ buttonList: { buttons } }],
        });
    }

    const chatCard = {
        header: {
            title: params.title,
            subtitle: params.subtitle,
            imageUrl: "https://xiri.ai/icon.png",
            imageType: "CIRCLE",
        },
        sections,
    };

    try {
        const resp = await fetch(LEADS_CHAT_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: params.fallbackText,
                cardsV2: [{ cardId: params.cardId, card: chatCard }],
            }),
        });
        if (!resp.ok) {
            logger.error(`[LeadsChat] Webhook failed (${resp.status}):`, await resp.text());
            return false;
        }
        logger.info(`[LeadsChat] Sent Google Chat notification (${params.cardId})`);
        return true;
    } catch (err) {
        logger.error(`[LeadsChat] Webhook error (${params.cardId}):`, err);
        return false;
    }
}
