import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";

/**
 * Google Chat alert for contractor calculator captures.
 * Distinct from onboarding-complete alerts.
 */
export const onCalculatorLeadCaptured = onDocumentCreated(
    { document: "vendors/{vendorId}" },
    async (event) => {
        const data = event.data?.data();
        if (!data) return;

        if (data.source !== "calculator_contractor") return;

        const vendorId = event.params.vendorId;
        const email = typeof data.email === "string" ? data.email.trim() : "";
        const contactName = typeof data.name === "string" ? data.name.trim() : "";
        const businessName = typeof data.businessName === "string" ? data.businessName.trim() : "";
        const calc = data.calculatorData || {};
        const routing = data.routing || {};
        const contractorCounty = typeof data.contractorCounty === "string" ? data.contractorCounty.trim() : "unknown";
        const funnel = typeof routing.funnel === "string" ? routing.funnel.trim() : "unknown";
        const destination = typeof routing.destination === "string" ? routing.destination.trim() : "";

        const stateFromCalc = typeof calc.state === "string" ? calc.state.trim() : "";
        const location = [
            typeof data.city === "string" ? data.city.trim() : "",
            typeof data.state === "string" ? data.state.trim() : "",
            typeof data.zip === "string" ? data.zip.trim() : "",
        ].filter(Boolean).join(", ") || stateFromCalc || "Unknown";

        const facilityType = typeof calc.facilityType === "string" ? calc.facilityType.trim() : "Unknown";
        const sqft = typeof calc.sqft === "number" ? calc.sqft.toLocaleString("en-US") : "Unknown";
        const daysPerWeek = typeof calc.daysPerWeek === "number" ? `${calc.daysPerWeek}x/week` : "Unknown";
        const est = typeof calc.monthlyEstimate === "number"
            ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(calc.monthlyEstimate)
            : "Unknown";

        const VENDOR_CHAT_WEBHOOK =
            "https://chat.googleapis.com/v1/spaces/AAQAYd8NzdA/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=WFryLEM_LRyVmM5I0m5A0KghBN8yL3Fw8vZMLgBDjOQ";

        const crmLink = `https://app.xiri.ai/supply/crm/${vendorId}`;

        const chatCard = {
            header: {
                title: "🧮 Calculator Use (Contractor)",
                subtitle: `${businessName || contactName || email || "Unknown"} • ${location}`,
                imageUrl: "https://xiri.ai/icon.png",
                imageType: "CIRCLE",
            },
            sections: [
                {
                    widgets: [
                        {
                            decoratedText: {
                                topLabel: "TAG",
                                text: "calculator_contractor",
                            },
                        },
                        {
                            decoratedText: {
                                topLabel: "EMAIL",
                                text: email || "N/A",
                                startIcon: { knownIcon: "EMAIL" },
                            },
                        },
                        {
                            decoratedText: {
                                topLabel: "CONTACT",
                                text: contactName || "N/A",
                                startIcon: { knownIcon: "PERSON" },
                            },
                        },
                        {
                            decoratedText: {
                                topLabel: "LOCATION (BEST AVAILABLE)",
                                text: location,
                                startIcon: { knownIcon: "MAP_PIN" },
                            },
                        },
                        {
                            decoratedText: {
                                topLabel: "ROUTING",
                                text: `${funnel}${contractorCounty ? ` • county: ${contractorCounty}` : ""}`,
                            },
                        },
                    ],
                },
                {
                    header: "Calculator Inputs",
                    widgets: [
                        {
                            textParagraph: {
                                text: `Facility: ${facilityType}<br/>Sq Ft: ${sqft}<br/>Frequency: ${daysPerWeek}<br/>Monthly Estimate: ${est}`,
                            },
                        },
                    ],
                },
                {
                    widgets: [
                        {
                            buttonList: {
                                buttons: [
                                    {
                                        text: "Open In Supply CRM",
                                        onClick: { openLink: { url: crmLink } },
                                    },
                                    ...(email ? [{
                                        text: "Email Lead",
                                        onClick: { openLink: { url: `mailto:${email}` } },
                                    }] : []),
                                    ...(destination ? [{
                                        text: "Open Routed Destination",
                                        onClick: { openLink: { url: destination } },
                                    }] : []),
                                ],
                            },
                        },
                    ],
                },
            ],
        };

        try {
            const chatResp = await fetch(VENDOR_CHAT_WEBHOOK, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: `Calculator Use: ${email || "unknown email"} (${location})`,
                    cardsV2: [{ cardId: `calculator-capture-${vendorId}`, card: chatCard }],
                }),
            });
            if (!chatResp.ok) {
                logger.error(`Calculator chat webhook failed (${chatResp.status}):`, await chatResp.text());
                return;
            }
            logger.info(`Calculator lead chat notification sent for vendor ${vendorId}`);
        } catch (error) {
            logger.error("Calculator chat webhook error:", error);
        }
    }
);
