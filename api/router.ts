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

import eventsAttendanceHandler from './_handlers/events/attendance.js';
import eventsAttendeesHandler from './_handlers/events/attendees.js';
import eventsContextHandler from './_handlers/events/context.js';
import eventsExportRequestHandler from './_handlers/events/export-request.js';
import eventsLoginHandler from './_handlers/events/login.js';
import eventsRegisterHandler from './_handlers/events/register.js';
import eventsStatsHandler from './_handlers/events/stats.js';
import eventsImportRequestHandler from './_handlers/events/import-request.js';
import eventsImportTemplateHandler from './_handlers/events/import-template.js';

import paymentsVerifyHandler from './_handlers/payments/verify.js';

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
  'events/attendance': eventsAttendanceHandler,
  'events/attendees': eventsAttendeesHandler,
  'events/context': eventsContextHandler,
  'events/export-request': eventsExportRequestHandler,
  'events/login': eventsLoginHandler,
  'events/register': eventsRegisterHandler,
  'events/stats': eventsStatsHandler,
  'events/import-request': eventsImportRequestHandler,
  'events/import-template': eventsImportTemplateHandler,
  'payments/verify': paymentsVerifyHandler,
};

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

  return targetHandler(req, res);
}
