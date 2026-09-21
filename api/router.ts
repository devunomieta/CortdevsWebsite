import type { VercelRequest, VercelResponse } from '@vercel/node';

// Static route imports for fast serverless bundle execution
import contactHandler from './_handlers/contact.js';
import diagHandler from './_handlers/diag.js';
import healthHandler from './_handlers/health.js';
import reviewHandler from './_handlers/review.js';
import sendEmailHandler from './_handlers/send-email.js';
import testSmtpHandler from './_handlers/test-smtp.js';

import adminEventsHandler from './_handlers/admin/events.js';
import adminDeleteUserHandler from './_handlers/admin/delete-user.js';
import adminManageRecordsHandler from './_handlers/admin/manage-records.js';
import adminEventsAuditLogHandler from './_handlers/admin/events/audit-log.js';
import adminEventsCredentialsEmailHandler from './_handlers/admin/events/credentials-email.js';
import adminEventsCredentialsHandler from './_handlers/admin/events/credentials.js';
import adminEventsExportRequestsHandler from './_handlers/admin/events/export-requests.js';
import adminEventsNotificationsHandler from './_handlers/admin/events/notifications.js';
import adminEventsPurgeHandler from './_handlers/admin/events/purge.js';
import adminEventsUpdateHandler from './_handlers/admin/events/update.js';
import adminEventsImportsHandler from './_handlers/admin/events/imports.js';

import authRequestResetHandler from './_handlers/auth/request-reset.js';
import authResetPasswordHandler from './_handlers/auth/reset-password.js';
import authVerifyPasswordHandler from './_handlers/auth/verify-password.js';

import cronEventRetentionHandler from './_handlers/cron/event-retention.js';
import cronSplitsubsEscrowReleaseHandler from './_handlers/cron/splitsubs-escrow-release.js';
import cronSplitsubsRenewalRemindersHandler from './_handlers/cron/splitsubs-renewal-reminders.js';

import eventsAttendanceHandler from './_handlers/events/attendance.js';
import eventsAttendeesHandler from './_handlers/events/attendees.js';
import eventsContextHandler from './_handlers/events/context.js';
import eventsExportRequestHandler from './_handlers/events/export-request.js';
import eventsLoginHandler from './_handlers/events/login.js';
import eventsRegisterHandler from './_handlers/events/register.js';
import eventsStatsHandler from './_handlers/events/stats.js';
import eventsImportRequestHandler from './_handlers/events/import-request.js';
import eventsImportTemplateHandler from './_handlers/events/import-template.js';
import eventsAnalyticsHandler from './_handlers/events/analytics.js';

import paymentsVerifyHandler from './_handlers/payments/verify.js';

import splitsubsServicesHandler from './_handlers/splitsubs/services.js';
import splitsubsListingsHandler from './_handlers/splitsubs/listings.js';
import splitsubsHostListingsHandler from './_handlers/splitsubs/host-listings.js';
import splitsubsHostProfileHandler from './_handlers/splitsubs/host-profile.js';
import splitsubsProfileHandler from './_handlers/splitsubs/profile.js';
import splitsubsTransactionsHandler from './_handlers/splitsubs/transactions.js';
import splitsubsMySeatsHandler from './_handlers/splitsubs/my-seats.js';
import splitsubsJoinHandler from './_handlers/splitsubs/join.js';
import splitsubsAccessHandler from './_handlers/splitsubs/access.js';
import splitsubsTicketsHandler from './_handlers/splitsubs/tickets.js';
import splitsubsRatingsHandler from './_handlers/splitsubs/ratings.js';
import splitsubsDisputesHandler from './_handlers/splitsubs/disputes.js';
import splitsubsPaymentsWebhookHandler from './_handlers/splitsubs/payments-webhook.js';
import splitsubsPaymentsVerifyHandler from './_handlers/splitsubs/payments-verify.js';
import splitsubsWalletHandler from './_handlers/splitsubs/wallet.js';
import splitsubsPrepaidWalletHandler from './_handlers/splitsubs/prepaid-wallet.js';

import adminSplitsubsServicesHandler from './_handlers/admin/splitsubs/services.js';
import adminSplitsubsListingsHandler from './_handlers/admin/splitsubs/listings.js';
import adminSplitsubsSettingsHandler from './_handlers/admin/splitsubs/settings.js';
import adminSplitsubsHostsHandler from './_handlers/admin/splitsubs/hosts.js';
import adminSplitsubsDisputesHandler from './_handlers/admin/splitsubs/disputes.js';
import adminSplitsubsSettlementsHandler from './_handlers/admin/splitsubs/settlements.js';
import adminSplitsubsTicketsHandler from './_handlers/admin/splitsubs/tickets.js';
import adminSplitsubsAnalyticsHandler from './_handlers/admin/splitsubs/analytics.js';
import adminSplitsubsAuditLogHandler from './_handlers/admin/splitsubs/audit-log.js';

// Vercel's default bodyParser is disabled below so the Paystack webhook can
// verify its HMAC signature against the exact raw bytes received — a
// re-serialized copy of the parsed JSON isn't guaranteed to match byte-for-byte.
// Every other handler is unaffected: the body is still parsed into req.body
// just below, before any route runs.
export const config = {
  api: { bodyParser: false },
};

const routes: Record<string, (req: VercelRequest, res: VercelResponse) => any> = {
  'contact': contactHandler,
  'diag': diagHandler,
  'health': healthHandler,
  'review': reviewHandler,
  'send-email': sendEmailHandler,
  'test-smtp': testSmtpHandler,
  'admin/events': adminEventsHandler,
  'admin/delete-user': adminDeleteUserHandler,
  'admin/manage-records': adminManageRecordsHandler,
  'admin/events/audit-log': adminEventsAuditLogHandler,
  'admin/events/credentials-email': adminEventsCredentialsEmailHandler,
  'admin/events/credentials': adminEventsCredentialsHandler,
  'admin/events/export-requests': adminEventsExportRequestsHandler,
  'admin/events/notifications': adminEventsNotificationsHandler,
  'admin/events/purge': adminEventsPurgeHandler,
  'admin/events/update': adminEventsUpdateHandler,
  'admin/events/imports': adminEventsImportsHandler,
  'auth/request-reset': authRequestResetHandler,
  'auth/reset-password': authResetPasswordHandler,
  'auth/verify-password': authVerifyPasswordHandler,
  'cron/event-retention': cronEventRetentionHandler,
  'cron/splitsubs-escrow-release': cronSplitsubsEscrowReleaseHandler,
  'cron/splitsubs-renewal-reminders': cronSplitsubsRenewalRemindersHandler,
  'events/attendance': eventsAttendanceHandler,
  'events/attendees': eventsAttendeesHandler,
  'events/context': eventsContextHandler,
  'events/export-request': eventsExportRequestHandler,
  'events/login': eventsLoginHandler,
  'events/register': eventsRegisterHandler,
  'events/stats': eventsStatsHandler,
  'events/import-request': eventsImportRequestHandler,
  'events/import-template': eventsImportTemplateHandler,
  'events/analytics': eventsAnalyticsHandler,
  'payments/verify': paymentsVerifyHandler,
  'splitsubs/services': splitsubsServicesHandler,
  'splitsubs/listings': splitsubsListingsHandler,
  'splitsubs/host-listings': splitsubsHostListingsHandler,
  'splitsubs/host-profile': splitsubsHostProfileHandler,
  'splitsubs/profile': splitsubsProfileHandler,
  'splitsubs/transactions': splitsubsTransactionsHandler,
  'splitsubs/my-seats': splitsubsMySeatsHandler,
  'splitsubs/join': splitsubsJoinHandler,
  'splitsubs/access': splitsubsAccessHandler,
  'splitsubs/tickets': splitsubsTicketsHandler,
  'splitsubs/ratings': splitsubsRatingsHandler,
  'splitsubs/disputes': splitsubsDisputesHandler,
  'splitsubs/payments-webhook': splitsubsPaymentsWebhookHandler,
  'splitsubs/payments-verify': splitsubsPaymentsVerifyHandler,
  'splitsubs/wallet': splitsubsWalletHandler,
  'splitsubs/prepaid-wallet': splitsubsPrepaidWalletHandler,
  'admin/splitsubs/services': adminSplitsubsServicesHandler,
  'admin/splitsubs/listings': adminSplitsubsListingsHandler,
  'admin/splitsubs/settings': adminSplitsubsSettingsHandler,
  'admin/splitsubs/hosts': adminSplitsubsHostsHandler,
  'admin/splitsubs/disputes': adminSplitsubsDisputesHandler,
  'admin/splitsubs/settlements': adminSplitsubsSettlementsHandler,
  'admin/splitsubs/tickets': adminSplitsubsTicketsHandler,
  'admin/splitsubs/analytics': adminSplitsubsAnalyticsHandler,
  'admin/splitsubs/audit-log': adminSplitsubsAuditLogHandler,
};

// Reads the raw request body (once) and, for JSON payloads, parses it onto
// req.body — mirroring what Vercel's built-in bodyParser used to do for us,
// but also preserving the untouched raw string on req.rawBody for handlers
// that need to verify it (webhook signatures).
async function readBody(req: VercelRequest): Promise<{ raw: string; json: any }> {
  if (req.method === 'GET' || req.method === 'HEAD') return { raw: '', json: undefined };

  const chunks: Buffer[] = [];
  for await (const chunk of req as any) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return { raw, json: {} };

  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.includes('application/json')) return { raw, json: {} };

  try {
    return { raw, json: JSON.parse(raw) };
  } catch {
    return { raw, json: {} };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Determine relative subpath from Vercel catch-all parameter or URL pathname
  let subpath = '';
  if (req.query && req.query.path) {
    subpath = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
  } else if (req.url) {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    subpath = urlObj.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  }

  const targetHandler = routes[subpath];
  if (!targetHandler) {
    return res.status(404).json({ error: 'Endpoint Not Found', subpath });
  }

  const { raw, json } = await readBody(req);
  (req as any).rawBody = raw;
  (req as any).body = json;

  return targetHandler(req, res);
}
