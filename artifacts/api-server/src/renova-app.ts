import express, {
  type ErrorRequestHandler,
  type Express,
  type RequestHandler,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Prompt H, Task 9.1: CORS is allow-list only, evaluated per request so
// the list can be tested and changed without a restart. Only the origins
// in CORS_ORIGINS may call the API with credentials; there is no `*` with
// credentials and no reflected Origin — an unlisted origin gets no
// Access-Control-Allow-Origin header at all, and with CORS_ORIGINS empty
// nothing is allowed (fail-closed). The production value of CORS_ORIGINS
// lives in Vercel env vars and is NOT visible from code (CAN'T TELL): it
// must list https://nirmaq.in and only the Vercel preview origins the
// team actually uses, if any.
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, false);
      return callback(
        null,
        (process.env.CORS_ORIGINS ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .includes(origin),
      );
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use("/api/billing/webhook", express.raw({ type: "application/json", limit: "256kb" }));
app.use(express.json({ limit: "256kb", strict: true }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

// Prompt H, Task 9.2: security headers on every /api response. The API
// serves JSON only, so the CSP is restrictive (nothing may load or frame
// it). HSTS is set here; browsers ignore it over plain http (local dev),
// and it is enforced on the https production host.
app.use("/api", (_req, res, next) => {
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'",
  );
  next();
});

app.use(
  "/api",
  (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  },
  router,
);

const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
};

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const status = typeof error?.status === "number" ? error.status : 500;
  const isValidationError = error?.name === "ZodError";
  const isConfigurationUnavailable =
    error?.code === "EMAIL_DELIVERY_UNAVAILABLE" ||
    error?.code === "EMAIL_DELIVERY_FAILED" ||
    error?.code === "AUTH_TOKEN_SECRET_UNAVAILABLE";
  const responseStatus = isValidationError ? 400 : status;

  if (responseStatus >= 500) {
    req.log?.error({ statusCode: responseStatus }, "API request failed; sensitive details withheld");
  }

  res.status(responseStatus).json({
    error: isValidationError
      ? "Validation failed"
      : isConfigurationUnavailable
        ? "Account email verification is not configured yet"
        : responseStatus === 413
          ? "Request body is too large"
          : responseStatus === 503 &&
              error?.message === "DATABASE_URL is not configured"
            ? "Database is not configured"
            : responseStatus >= 500
              ? "Internal server error"
              : error?.message || "Invalid request",
    ...(isValidationError && Array.isArray(error?.issues)
      ? {
          issues: error.issues.map(
            (issue: { path?: unknown[]; message?: string }) => ({
              field: issue.path?.join("."),
              message: issue.message,
            }),
          ),
        }
      : {}),
  });
};

app.use(notFound);
app.use(errorHandler);

export default app;
