import type { IncomingMessage, ServerResponse } from "node:http";
import { config } from "../config.js";
import { createAccessToken, createRefreshToken, verifyUserJwt } from "../auth/jwt.js";
import { upsertGoogleUser, getOrCreateDevUser, findUserById } from "../db/user-repo.js";

export function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(data));
}

function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(html);
}

function getCallbackUrl(req: IncomingMessage, url: URL): string {
  if (config.googleRedirectUri) {
    return config.googleRedirectUri;
  }
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost:8080";
  const proto =
    (req.headers["x-forwarded-proto"] as string) ||
    (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}/auth/google/callback`;
}

function renderRedirectPage(targetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cloud Agent Authenticated</title>
  <meta http-equiv="refresh" content="0; url=${targetUrl}">
  <style>
    body {
      background-color: #0d1117;
      color: #f0f6fc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
      box-sizing: border-box;
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 16px;
      padding: 32px 24px;
      text-align: center;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
    .icon {
      width: 48px;
      height: 48px;
      border-radius: 24px;
      background: rgba(0, 119, 182, 0.15);
      border: 1px solid rgba(0, 119, 182, 0.35);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }
    .icon svg {
      width: 24px;
      height: 24px;
      stroke: #0096c7;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 19px;
      font-weight: 600;
      color: #f0f6fc;
    }
    p {
      color: #8b949e;
      font-size: 13.5px;
      line-height: 1.5;
      margin: 0 0 24px;
    }
    .btn {
      display: inline-block;
      width: 100%;
      box-sizing: border-box;
      background: #0077b6;
      color: #ffffff;
      padding: 12px 20px;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      transition: background 0.15s ease;
    }
    .btn:hover {
      background: #0096c7;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    </div>
    <h2>Authentication Complete</h2>
    <p>Returning you to the Cloud Agent app...</p>
    <a href="${targetUrl}" class="btn" id="openBtn">Open Cloud Agent</a>
  </div>
  <script>
    setTimeout(function() {
      window.location.href = "${targetUrl}";
    }, 50);
  </script>
</body>
</html>`;
}

function renderErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authentication Error</title>
  <style>
    body {
      background-color: #0d1117;
      color: #f0f6fc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
    }
    .card {
      background: #161b22;
      border: 1px solid #da3633;
      border-radius: 16px;
      padding: 32px 24px;
      text-align: center;
      max-width: 380px;
      width: 100%;
    }
    h2 { color: #f85149; margin: 0 0 12px; font-size: 18px; }
    p { color: #8b949e; font-size: 14px; line-height: 1.5; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Sign-In Failed</h2>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

export async function handleAuthRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): Promise<boolean> {
  const method = req.method?.toUpperCase();
  const pathname = url.pathname.replace(/\/+$/, "");

  // CORS Preflight
  if (method === "OPTIONS" && (pathname.startsWith("/auth") || pathname.startsWith("/api/auth"))) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return true;
  }

  // 1. Initiate Google OAuth: GET /auth/google or GET /api/auth/google
  if (method === "GET" && (pathname === "/auth/google" || pathname === "/api/auth/google")) {
    if (!config.googleClientId) {
      sendJson(res, 500, {
        error: "GOOGLE_CLIENT_ID is not configured in Gateway environment variables",
      });
      return true;
    }

    const returnUrl = url.searchParams.get("returnUrl") || url.searchParams.get("redirect_uri") || "cloud-agent://auth";
    const statePayload = {
      returnUrl,
      ts: Date.now(),
    };
    const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");
    const callbackUrl = getCallbackUrl(req, url);

    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", config.googleClientId);
    googleAuthUrl.searchParams.set("redirect_uri", callbackUrl);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "openid email profile");
    googleAuthUrl.searchParams.set("access_type", "offline");
    googleAuthUrl.searchParams.set("prompt", "select_account");
    googleAuthUrl.searchParams.set("state", state);

    res.writeHead(302, {
      Location: googleAuthUrl.toString(),
    });
    res.end();
    return true;
  }

  // 2. Google OAuth Callback: GET /auth/google/callback or GET /api/auth/google/callback
  if (
    method === "GET" &&
    (pathname === "/auth/google/callback" || pathname === "/api/auth/google/callback")
  ) {
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const state = url.searchParams.get("state");

    let returnUrl = "cloud-agent://auth";
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
        if (decoded?.returnUrl) {
          returnUrl = decoded.returnUrl;
        }
      } catch (e) {
        console.warn("[Gateway Auth] Failed to parse OAuth state:", e);
      }
    }

    if (error) {
      console.warn("[Gateway Auth] Google OAuth error returned:", error);
      const target = new URL(returnUrl);
      target.searchParams.set("error", error);
      res.writeHead(302, { Location: target.toString() });
      res.end();
      return true;
    }

    if (!code) {
      sendHtml(res, 400, renderErrorPage("Missing authorization code from Google"));
      return true;
    }

    try {
      const callbackUrl = getCallbackUrl(req, url);

      // Exchange authorization code with Google for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: config.googleClientId || "",
          client_secret: config.googleClientSecret || "",
          redirect_uri: callbackUrl,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("[Gateway Auth] Google token exchange failed:", errText);
        sendHtml(res, 400, renderErrorPage(`Google token exchange failed: ${errText}`));
        return true;
      }

      const tokens = (await tokenRes.json()) as { access_token?: string; id_token?: string };
      if (!tokens.access_token) {
        sendHtml(res, 400, renderErrorPage("No access token received from Google"));
        return true;
      }

      // Fetch user profile from OpenID Connect
      const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userRes.ok) {
        sendHtml(res, 400, renderErrorPage("Failed to fetch user profile from Google"));
        return true;
      }

      const profile = (await userRes.json()) as {
        sub: string;
        email: string;
        name?: string;
        picture?: string;
      };

      if (!profile.sub || !profile.email) {
        sendHtml(res, 400, renderErrorPage("Incomplete user profile from Google"));
        return true;
      }

      // Upsert user into MongoDB
      const user = await upsertGoogleUser({
        googleId: profile.sub,
        email: profile.email,
        name: profile.name || profile.email.split("@")[0],
        avatarUrl: profile.picture,
      });

      const userId = user._id ? user._id.toString() : "user";
      const accessToken = createAccessToken(userId);
      const refreshToken = createRefreshToken(userId);

      // Formulate mobile deep link: cloud-agent://auth?token=...
      const target = new URL(returnUrl);
      target.searchParams.set("token", accessToken);
      target.searchParams.set("refreshToken", refreshToken);
      target.searchParams.set("userId", userId);
      target.searchParams.set("email", user.email);
      target.searchParams.set("name", user.name);
      if (user.avatar_url) {
        target.searchParams.set("avatarUrl", user.avatar_url);
      }

      const targetUrl = target.toString();

      // Return both 302 Location and fallback HTML for seamless handoff
      res.writeHead(302, {
        Location: targetUrl,
        "Content-Type": "text/html; charset=utf-8",
      });
      res.end(renderRedirectPage(targetUrl));
      return true;
    } catch (err: any) {
      console.error("[Gateway Auth] OAuth callback exception:", err);
      sendHtml(res, 500, renderErrorPage(err?.message || "Internal OAuth authentication error"));
      return true;
    }
  }

  // 3. Developer Login: POST /auth/dev-login or POST /api/auth/dev-login
  if (
    method === "POST" &&
    (pathname === "/auth/dev-login" || pathname === "/api/auth/dev-login")
  ) {
    try {
      const devUser = await getOrCreateDevUser();
      const userId = devUser._id ? devUser._id.toString() : "dev_user_1";
      const accessToken = createAccessToken(userId);
      const refreshToken = createRefreshToken(userId);

      sendJson(res, 200, {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "bearer",
        user: {
          id: userId,
          name: devUser.name,
          email: devUser.email,
          username: devUser.username,
          avatarUrl: devUser.avatar_url,
          role: devUser.role,
          plan: devUser.plan,
        },
      });
      return true;
    } catch (err: any) {
      console.error("[Gateway Auth] Dev login error:", err);
      sendJson(res, 500, { error: err?.message || "Dev login failed" });
      return true;
    }
  }

  // 4. Current User Profile: GET /auth/me or GET /api/auth/me
  if (method === "GET" && (pathname === "/auth/me" || pathname === "/api/auth/me")) {
    const authHeader = req.headers["authorization"] || "";
    const authUser = verifyUserJwt(authHeader);
    if (!authUser) {
      sendJson(res, 401, { error: "Invalid or expired token" });
      return true;
    }

    try {
      const user = await findUserById(authUser.userId);
      if (!user) {
        sendJson(res, 404, { error: "User not found" });
        return true;
      }

      sendJson(res, 200, {
        id: user._id ? user._id.toString() : authUser.userId,
        name: user.name,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatar_url,
        plan: user.plan,
        role: user.role,
        isActive: user.is_active,
      });
      return true;
    } catch (err: any) {
      console.error("[Gateway Auth] /auth/me error:", err);
      sendJson(res, 500, { error: "Failed to load user profile" });
      return true;
    }
  }

  return false;
}
