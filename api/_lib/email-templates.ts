export interface EmailTemplate {
    id: string;
    name: string;
    description: string;
    subject: string;
    placeholders: string[];
    html: (data: any) => string;
}

const baseStyles = `
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 40px; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    .button { display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px; font-weight: 600; margin-top: 20px; }
    .highlight { color: #000; font-weight: 700; }
    .section { margin-bottom: 30px; }
    .budget-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .budget-table th, .budget-table td { text-align: left; padding: 12px; border-bottom: 1px solid #eee; }
    .budget-table th { background-color: #f9f9f9; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; }
`;

export const emailTemplates: Record<string, EmailTemplate> = {
    'project_proposal': {
        id: 'project_proposal',
        name: 'Project Proposal',
        description: 'Professional pitch for new leads.',
        subject: 'Project Proposal: {{projectTitle}} | CortDevs',
        placeholders: ['clientName', 'projectTitle', 'approachDetails'],
        html: (data) => `
            <html>
                <head><style>${baseStyles}</style></head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2 style="letter-spacing: -1px; margin: 0;">CortDevs</h2>
                            <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #666;">Proposal</p>
                        </div>
                        <div class="section">
                            <p>Hi ${data.clientName || 'there'},</p>
                            <p>It was a pleasure discussing your vision for <span class="highlight">${data.projectTitle}</span>. Based on our conversation, we've drafted a comprehensive strategy to bring this project to life with the precision and performance CortDevs is known for.</p>
                        </div>
                        <div class="section">
                            <h3 style="font-size: 14px; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 5px;">Our Approach</h3>
                            <p>${data.approachDetails || 'We focus on building scalable, conversion-optimized solutions tailored to your specific business goals.'}</p>
                        </div>
                        <div class="section">
                            <h3 style="font-size: 14px; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 5px;">Key Objectives</h3>
                            <ul>
                                ${data.objectives?.map((obj: string) => `<li>${obj}</li>`).join('') || '<li>Full-cycle development from design to deployment</li><li>Performance-first architecture</li>'}
                            </ul>
                        </div>
                        <div class="footer">
                            <p>&copy; ${new Date().getFullYear()} CortDevs Group. Secure Proposal.</p>
                        </div>
                    </div>
                </body>
            </html>
        `
    },
    'budgets_estimates': {
        id: 'budgets_estimates',
        name: 'Budgets & Estimates',
        description: 'Detailed financial breakdown.',
        subject: 'Budget Estimate: {{projectTitle}} | CortDevs',
        placeholders: ['clientName', 'projectTitle', 'totalBudget'],
        html: (data) => `
            <html>
                <head><style>${baseStyles}</style></head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2 style="letter-spacing: -1px; margin: 0;">CortDevs</h2>
                            <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #666;">Estimates</p>
                        </div>
                        <div class="section">
                            <p>Hi ${data.clientName},</p>
                            <p>Here is the detailed budget breakdown for <span class="highlight">${data.projectTitle}</span>.</p>
                            <table class="budget-table">
                                <thead>
                                    <tr><th>Phase</th><th>Deliverables</th><th>Investment</th></tr>
                                </thead>
                                <tbody>
                                    ${data.breakdown?.map((item: any) => `
                                        <tr>
                                            <td>${item.phase}</td>
                                            <td>${item.deliverables}</td>
                                            <td>${item.price}</td>
                                        </tr>
                                    `).join('') || '<tr><td>Phase 1</td><td>Initial Development</td><td>$TBD</td></tr>'}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="2" style="text-align: right; font-weight: bold;">TOTAL ESTIMATE:</td>
                                        <td style="font-weight: bold; background: #f0f0f0;">${data.totalBudget}</td>
                                    </tr>
                                </tfoot>
                            </table>
                            <p style="font-size: 12px; color: #666; font-style: italic;">* Note: This estimate is valid for 14 days and reflects current requirements.</p>
                        </div>
                        <div class="footer">
                            <p>&copy; ${new Date().getFullYear()} CortDevs Group. Financial Transparency.</p>
                        </div>
                    </div>
                </body>
            </html>
        `
    },
    'project_approval': {
        id: 'project_approval',
        name: 'Project Approval',
        description: 'Final confirmation with invoice trigger.',
        subject: 'Project Approved: {{projectTitle}} | Next Steps',
        placeholders: ['clientName', 'projectTitle', 'approvedBudget', 'leadId'],
        html: (data) => `
            <html>
                <head><style>${baseStyles}</style></head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2 style="letter-spacing: -1px; margin: 0; color: #10b981;">Contract Executed</h2>
                            <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #666;">Commencement Notice</p>
                        </div>
                        <div class="section">
                            <p>Fantastic news, ${data.clientName}!</p>
                            <p>Your project <span class="highlight">${data.projectTitle}</span> has been officially approved with a final budget of <span class="highlight">${data.approvedBudget}</span>.</p>
                            <p>We are now ready to move into the active development phase. To satisfy the initial deposit and lock in your development window, please use the secure button below.</p>
                            <div style="text-align: center;">
                                <a href="${process.env.VITE_APP_URL}/admin/invoices/generate?leadId=${data.leadId}&action=initial" class="button">GENERATE INITIAL INVOICE</a>
                            </div>
                        </div>
                        <div class="footer">
                            <p>&copy; ${new Date().getFullYear()} CortDevs Group. Forward Motion.</p>
                        </div>
                    </div>
                </body>
            </html>
        `
    },
    'project_review': {
        id: 'project_review',
        name: 'Project Review',
        description: 'Strategic milestone check-in.',
        subject: 'Milestone Review: {{milestoneName}} | {{projectTitle}}',
        placeholders: ['clientName', 'projectTitle', 'milestoneName', 'status', 'accomplishments'],
        html: (data) => `
            <html>
                <head><style>${baseStyles}</style></head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2 style="letter-spacing: -1px; margin: 0;">CortDevs</h2>
                            <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #666;">Project Intelligence</p>
                        </div>
                        <div class="section">
                            <p>Hello ${data.clientName},</p>
                            <p>We have reached the <span class="highlight">${data.milestoneName}</span> milestone for <span class="highlight">${data.projectTitle}</span>. Transparency is core to our process, so we've prepared a brief review of our progress.</p>
                            <div style="background: #f9f9f9; padding: 20px; border-left: 4px solid #000;">
                                <p style="margin: 0;"><strong>Status:</strong> ${data.status || 'On Track'}</p>
                                <p style="margin: 10px 0 0 0;"><strong>Accomplishments:</strong> ${data.accomplishments || 'Core logic and architecture finalized.'}</p>
                            </div>
                        </div>
                        <div class="footer">
                            <p>&copy; ${new Date().getFullYear()} CortDevs Group. Strategic Oversight.</p>
                        </div>
                    </div>
                </body>
            </html>
        `
    },
    'project_completion': {
        id: 'project_completion',
        name: 'Project Completion',
        description: 'Final delivery and balance notice.',
        subject: 'Project Complete: {{projectTitle}} | Final Delivery',
        placeholders: ['clientName', 'projectTitle', 'pendingBalance', 'clientId'],
        html: (data) => `
            <html>
                <head><style>${baseStyles}</style></head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2 style="letter-spacing: -1px; margin: 0; color: #000;">Success Secured</h2>
                            <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #666;">Delivery Confirmation</p>
                        </div>
                        <div class="section">
                            <p>Hi ${data.clientName},</p>
                            <p>We are thrilled to announce that <span class="highlight">${data.projectTitle}</span> is now complete and ready for final handover.</p>
                            ${data.pendingBalance > 0 ? `
                                <div style="background: #fff4f4; border: 1px solid #fee2e2; padding: 20px; border-radius: 4px;">
                                    <p style="margin: 0; color: #b91c1c; font-weight: bold;">NOTICE: PENDING BALANCE</p>
                                    <p style="margin: 10px 0;">Our records indicate a final balance of <span class="highlight">${data.currencySymbol || '$'}${data.pendingBalance}</span> for this project.</p>
                                    <a href="${process.env.VITE_APP_URL}/admin/invoices/generate?clientId=${data.clientId}&balance=${data.pendingBalance}" class="button" style="background-color: #b91c1c;">SEND BALANCE INVOICE</a>
                                </div>
                            ` : `<p>Your project is fully paid and ready for immediate deployment.</p>`}
                        </div>
                        <div class="footer">
                            <p>&copy; ${new Date().getFullYear()} CortDevs Group. Excellence Delivered.</p>
                        </div>
                    </div>
                </body>
            </html>
        `
    },
    'project_handover': {
        id: 'project_handover',
        name: 'Project Handover',
        description: 'Assets delivery and testimonial request.',
        subject: 'Handover Protocol: {{projectTitle}} | Assets & Feedback',
        placeholders: ['clientName', 'projectTitle', 'docsLink'],
        html: (data) => `
            <html>
                <head><style>${baseStyles}</style></head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2 style="letter-spacing: -1px; margin: 0;">CortDevs</h2>
                            <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #666;">System Transfer</p>
                        </div>
                        <div class="section">
                            <p>Hi ${data.clientName},</p>
                            <p>The keys to <span class="highlight">${data.projectTitle}</span> are now yours. Below you will find the access credentials and documentation links as discussed.</p>
                            <p><strong>Handover Docs:</strong> <a href="${data.docsLink}">${data.docsLink}</a></p>
                            <hr style="border: none; border-top: 1px dotted #ccc; margin: 30px 0;"/>
                            <p>We would value your feedback on our partnership. Sharing your experience helps us maintain our standards of excellence.</p>
                            <div style="text-align: center;">
                                <a href="${process.env.VITE_APP_URL}/work?review=true" class="button">SUBMIT PROJECT REVIEW</a>
                            </div>
                        </div>
                        <div class="footer">
                            <p>&copy; ${new Date().getFullYear()} CortDevs Group. Partnership Matured.</p>
                        </div>
                    </div>
                </body>
            </html>
        `
    },
    'newsletter_insight': {
        id: 'newsletter_insight',
        name: 'Monthly Tech Insight',
        description: 'General audience thought leadership.',
        subject: 'Tech Intelligence: Current Trends & Opportunities',
        placeholders: ['insightTitle', 'insightText', 'topic'],
        html: (data) => `
            <html>
                <head><style>${baseStyles}</style></head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2 style="letter-spacing: -1px; margin: 0;">CortDevs Insight</h2>
                            <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #666;">Intelligence Report</p>
                        </div>
                        <div class="section">
                            <h3 style="font-style: italic;">"${data.insightTitle || 'The Future of AI-Driven Commerce'}"</h3>
                            <p>${data.insightText || 'As the digital landscape evolves, staying ahead of performance benchmarks is no longer optional—it is a requirement.'}</p>
                            <p>This month, we explored how ${data.topic || 'serverless architectures'} are redefining scalability for mid-sized enterprises.</p>
                            <a href="${process.env.VITE_APP_URL}/services" class="button">EXPLORE SOLUTIONS</a>
                        </div>
                        <div class="footer">
                            <p>You received this as a subscriber of CortDevs Intel. <a href="#">Unsubscribe</a></p>
                            <p>&copy; ${new Date().getFullYear()} CortDevs Group.</p>
                        </div>
                    </div>
                </body>
            </html>
        `
    }
};
