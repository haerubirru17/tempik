import api from './api/routes';
import { handleEmail } from './email-handler';
import type { EmailHandlerEnv } from './email-handler';
import type { ApiEnv } from './api/routes';

/**
 * Tempik - Disposable Temp Mail on Cloudflare Workers
 *
 * Handles:
 * - fetch()  → API routes (static files served via Cloudflare Assets)
 * - email()  → inbound email processing via Cloudflare Email Worker
 */

// Combined env bindings
export interface Env extends ApiEnv, EmailHandlerEnv {}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const apiUrl = new URL(request.url);
      apiUrl.pathname = url.pathname.slice(4);
      const apiRequest = new Request(apiUrl, request);
      return api.fetch(apiRequest, env, ctx);
    }

    return new Response('Not found', { status: 404 });
  },

  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleEmail(message, env));
  },
};
