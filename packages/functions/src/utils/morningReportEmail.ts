/**
 * Morning Report Email — HTML Template Builder
 *
 * Generates a professional HTML email for the Green / Amber / Red tiers.
 * Designed to be glanceable in 3 seconds (Green) or actionable in 30 seconds (Red).
 */

// ─── Types ───────────────────────────────────────────────────────────

export type ReportTier = 'green' | 'amber' | 'red';

export interface ZoneResult {
    zoneName: string;
    tasksCompleted: number;
    tasksTotal: number;
    scannedAt: string; // ISO
}

export interface ReportIssue {
    type: 'late_start' | 'backup_dispatched' | 'partial_completion' | 'no_show' | 'locked_area' | 'supply_issue' | 'other';
    summary: string;      // e.g. "Crew arrived 45 min late"
    resolved: boolean;     // true = Amber, false = Red
    actionNeeded?: string; // e.g. "Please provide a key for Suite 201"
}

export interface MorningReportData {
    tier: ReportTier;
    buildingName: string;
    reportDate: string;   // e.g. "March 12, 2026"
    crewName: string;
    clockIn: string;      // e.g. "7:02 PM"
    clockOut: string;      // e.g. "10:38 PM"
    zonesCompleted: number;
    zonesTotal: number;
    zones: ZoneResult[];
    issues: ReportIssue[];
    complianceLogUrl?: string; // Link to public compliance log
}

// ─── Subject line builder ────────────────────────────────────────────

export function buildSubjectLine(data: MorningReportData): string {
    switch (data.tier) {
        case 'green':
            return `[No Action Needed] ${data.buildingName} — Cleaned ${data.zonesCompleted}/${data.zonesTotal} Zones`;
        case 'amber':
            return `[Resolved] ${data.buildingName} — Issue Handled, All Zones Completed`;
        case 'red':
            return `[Action Needed] ${data.buildingName} — Your Input Required`;
    }
}

// ─── HTML builder ────────────────────────────────────────────────────

const COLORS = {
    green: { bg: '#ecfdf5', border: '#059669', badge: '#059669', badgeText: '#ffffff', text: '#065f46' },
    amber: { bg: '#fffbeb', border: '#d97706', badge: '#d97706', badgeText: '#ffffff', text: '#92400e' },
    red:   { bg: '#fef2f2', border: '#dc2626', badge: '#dc2626', badgeText: '#ffffff', text: '#991b1b' },
};

const TIER_LABELS = {
    green: 'All Good',
    amber: 'Issue Resolved',
    red: 'Action Needed',
};

const TIER_ICONS = {
    green: '&#x2705;', // ✅
    amber: '&#x26A0;&#xFE0F;', // ⚠️
    red: '&#x1F534;', // 🔴
};

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildMorningReportHtml(data: MorningReportData): string {
    const c = COLORS[data.tier];
    const completionPct = data.zonesTotal > 0 ? Math.round((data.zonesCompleted / data.zonesTotal) * 100) : 0;

    // Zone rows
    const zoneRows = data.zones.map(z => {
        const complete = z.tasksCompleted >= z.tasksTotal;
        return `
        <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;">
                ${complete ? '&#x2705;' : '&#x26A0;&#xFE0F;'} ${escapeHtml(z.zoneName)}
            </td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; text-align: center;">
                ${z.tasksCompleted}/${z.tasksTotal}
            </td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #64748b; font-size: 13px;">
                ${z.scannedAt}
            </td>
        </tr>`;
    }).join('\n');

    // Issue rows (for Amber/Red)
    const issueSection = data.issues.length > 0 ? `
        <div style="margin-top: 24px; padding: 16px; background: ${c.bg}; border-left: 4px solid ${c.border}; border-radius: 4px;">
            <p style="margin: 0 0 12px 0; font-weight: 600; color: ${c.text};">
                ${data.tier === 'amber' ? '&#x26A0;&#xFE0F; Issues Resolved By XIRI' : '&#x1F534; Action Required'}
            </p>
            ${data.issues.map(issue => `
                <div style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px;">
                    <p style="margin: 0; font-size: 14px;">
                        ${issue.resolved ? '&#x2705;' : '&#x1F534;'} 
                        <strong>${escapeHtml(issue.summary)}</strong>
                    </p>
                    ${issue.actionNeeded ? `
                        <p style="margin: 8px 0 0 0; font-size: 13px; color: ${COLORS.red.text};">
                            <strong>We need your help:</strong> ${escapeHtml(issue.actionNeeded)}
                        </p>
                    ` : ''}
                </div>
            `).join('\n')}
        </div>
    ` : '';

    // CTA for Red tier
    const redCta = data.tier === 'red' ? `
        <div style="margin-top: 24px; text-align: center;">
            <a href="mailto:chris@xiri.ai?subject=RE: ${encodeURIComponent(data.buildingName)} Report&body=Regarding the issue reported:" 
               style="display: inline-block; padding: 12px 32px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">
                Respond to XIRI
            </a>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;">Or simply reply to this email</p>
        </div>
    ` : '';

    // Compliance log link
    const complianceLink = data.complianceLogUrl ? `
        <p style="margin: 16px 0 0 0; text-align: center;">
            <a href="${data.complianceLogUrl}" style="color: #0284c7; text-decoration: none; font-size: 13px;">
                View Full Compliance Log &rarr;
            </a>
        </p>
    ` : '';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(data.buildingName)} — Cleaning Report</title>
</head>
<body style="margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0c4a6e, #0369a1); padding: 24px; border-radius: 12px 12px 0 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td>
                        <p style="margin: 0; color: white; font-size: 20px; font-weight: 700;">XIRI</p>
                        <p style="margin: 2px 0 0 0; color: #93c5fd; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Facility Solutions</p>
                    </td>
                    <td style="text-align: right;">
                        <span style="display: inline-block; padding: 4px 12px; background: ${c.badge}; color: ${c.badgeText}; border-radius: 20px; font-size: 12px; font-weight: 600;">
                            ${TIER_ICONS[data.tier]} ${TIER_LABELS[data.tier]}
                        </span>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Body -->
        <div style="background: white; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
            
            <!-- Building + Date -->
            <h1 style="margin: 0 0 4px 0; font-size: 22px; color: #0f172a;">
                ${escapeHtml(data.buildingName)}
            </h1>
            <p style="margin: 0 0 20px 0; color: #64748b; font-size: 14px;">
                Cleaning Report &mdash; ${escapeHtml(data.reportDate)}
            </p>

            <!-- Summary Stats -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                <tr>
                    <td style="padding: 12px; background: #f8fafc; border-radius: 8px; text-align: center; width: 33%;">
                        <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${completionPct === 100 ? '#059669' : '#d97706'};">
                            ${completionPct}%
                        </p>
                        <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b; text-transform: uppercase;">Completion</p>
                    </td>
                    <td style="width: 8px;"></td>
                    <td style="padding: 12px; background: #f8fafc; border-radius: 8px; text-align: center; width: 33%;">
                        <p style="margin: 0; font-size: 24px; font-weight: 700; color: #0f172a;">
                            ${data.zonesCompleted}/${data.zonesTotal}
                        </p>
                        <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b; text-transform: uppercase;">Zones</p>
                    </td>
                    <td style="width: 8px;"></td>
                    <td style="padding: 12px; background: #f8fafc; border-radius: 8px; text-align: center; width: 33%;">
                        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #0f172a;">
                            ${escapeHtml(data.crewName)}
                        </p>
                        <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">
                            ${escapeHtml(data.clockIn)} &ndash; ${escapeHtml(data.clockOut)}
                        </p>
                    </td>
                </tr>
            </table>

            <!-- Zones Table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <tr style="background: #f8fafc;">
                    <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Zone</th>
                    <th style="padding: 8px 12px; text-align: center; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Tasks</th>
                    <th style="padding: 8px 12px; text-align: right; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Time</th>
                </tr>
                ${zoneRows}
            </table>

            ${issueSection}
            ${redCta}
            ${complianceLink}
        </div>

        <!-- Footer -->
        <div style="padding: 16px 24px; text-align: center; border-radius: 0 0 12px 12px; background: #f1f5f9; border: 1px solid #e2e8f0; border-top: none;">
            <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                XIRI Facility Solutions &middot; 418 Broadway, Ste N &middot; Albany, NY 12207
            </p>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">
                This is an automated report. Reply to this email or contact 
                <a href="mailto:chris@xiri.ai" style="color: #64748b;">chris@xiri.ai</a>
            </p>
        </div>
    </div>
</body>
</html>`;
}
