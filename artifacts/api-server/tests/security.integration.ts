import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import { and, eq } from "drizzle-orm";
import {
  engine,
  db,
  users,
  organizations,
  societies,
  organizationMembers,
  authSessions,
  authTokens,
  authRateLimits,
  enquiries,
  feasibilityRequests,
  feasibilityDocuments,
} from "./database";
import auth from "../src/routes/auth";
import renovaRouter from "../src/routes/renova";
import opportunitiesRouter from "../src/routes/opportunities";
import workspace from "../src/routes/workspace";
import enquiriesRouter from "../src/routes/enquiries";
import profilesRouter from "../src/routes/profiles";
import feasibilityRouter from "../src/routes/feasibility";
import {
  hashPassword,
  createSession,
  readSession,
  verifyPassword,
} from "../src/lib/session";
import { issueAuthToken, issueEmailOtp } from "../src/lib/auth-tokens";
import { testSandboxAndEmail } from "./sandbox-delivery";
import sandboxBillingRouter from "../src/routes/sandbox-billing";
import emailJobsRouter from "../src/routes/email-jobs";
import { testAuthDelivery } from "./auth-delivery";
// Prompt L — the standard tier is proven through the production router
// composition (routes/index.ts), and document uploads through the Blob stub.
import routes from "../src/routes/index";
import {
  authRateLimitSubject,
  rateLimitWindowStart,
} from "../src/lib/auth-rate-limit";
import { putCalls, resetPutCalls } from "./blob-stub";

const previousOtpSecret = process.env.RENOVA_AUTH_TOKEN_SECRET;
process.env.RENOVA_AUTH_TOKEN_SECRET =
  "TEST-ONLY-otp-secret-at-least-thirty-two-characters";
const journal = JSON.parse(
  await readFile("../../lib/db/drizzle/meta/_journal.json", "utf8"),
);
for (const entry of journal.entries)
  await engine.exec(
    await readFile(`../../lib/db/drizzle/${entry.tag}.sql`, "utf8"),
  );
// Phase B privacy tables (provisional 0010 — see docs/phase-b-migration-plan.md).
// The enquiry route now records a consent event with every enquiry, so the
// suite runs with the privacy schema applied, as deployments must.
await engine.exec(
  await readFile(
    "../../lib/db/drizzle/provisional/0010_privacy_phase_b.sql",
    "utf8",
  ),
);

const app = express();
app.use(
  "/api/billing/webhook",
  express.raw({ type: "application/json", limit: "256kb" }),
);
app.use(express.json(), cookieParser());
app.use(
  "/api",
  auth,
  renovaRouter,
  opportunitiesRouter,
  workspace,
  enquiriesRouter,
  profilesRouter,
  feasibilityRouter,
  sandboxBillingRouter,
  emailJobsRouter,
);
const testErrors: ErrorRequestHandler = (error, _request, response, _next) => {
  response
    .status(error.name === "ZodError" ? 400 : (error.status ?? 500))
    .json({ error: "Test request rejected" });
};
app.use(testErrors);
const server = createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
// Prompt L — a second app on the production router composition, so the
// standard tier is proven through the real wiring (routes/index.ts mounts
// standardRateLimit after health, before every other router). trust proxy: 1
// lets the tests set the client IP with X-Forwarded-For, which is how the
// per-IP buckets and the IP-rotation case are exercised. The main app above
// has no trust proxy and no standard tier: its request volume exceeds the
// per-IP tier, and its routers are mounted individually.
const miniApp = express();
miniApp.set("trust proxy", 1);
miniApp.use(express.json(), cookieParser());
miniApp.use("/api", routes);
const miniErrors: ErrorRequestHandler = (error, _request, response, _next) => {
  response
    .status(error.name === "ZodError" ? 400 : (error.status ?? 500))
    .json({ error: "Test request rejected" });
};
miniApp.use(miniErrors);
const miniServer = createServer(miniApp);
await new Promise<void>((resolve) =>
  miniServer.listen(0, "127.0.0.1", resolve),
);
const miniAddress = miniServer.address();
assert.ok(miniAddress && typeof miniAddress !== "string");
const miniOrigin = `http://127.0.0.1:${miniAddress.port}`;
let checks = 0;
async function request(
  path: string,
  method = "GET",
  cookie = "",
  body?: unknown,
) {
  return fetch(origin + "/api" + path, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function account(
  role: "SOCIETY" | "DEVELOPER" | "PMC" | "PROFESSIONAL",
  n: number,
) {
  const [user] = await db
    .insert(users)
    .values({
      email: `test-${role.toLowerCase()}-${n}@example.invalid`,
      displayName: `TEST ONLY ${role} ${n}`,
      role,
      passwordHash: hashPassword("old-password-test"),
      emailVerifiedAt: new Date(),
    })
    .returning();
  const [org] = await db
    .insert(organizations)
    .values({ name: `TEST ONLY ${role} ${n}`, kind: role })
    .returning();
  await db
    .insert(organizationMembers)
    .values({ userId: user.id, organizationId: org.id });
  if (role === "SOCIETY")
    await db.insert(societies).values({ organizationId: org.id });
  const response = await request("/auth/login", "POST", "", {
    email: user.email,
    password: "old-password-test",
  });
  assert.equal(response.status, 200);
  checks++;
  return {
    user,
    org,
    cookie: response.headers.get("set-cookie")!.split(";")[0],
  };
}
try {
  const professional = await account("PROFESSIONAL", 1);
  for (const specialization of [
    "ADVOCATE_LEGAL",
    "ARCHITECT",
    "STRUCTURAL_CONSULTANT",
    "VALUATION_FINANCE",
    "OTHER",
  ]) {
    const saved = await request("/profiles/me", "PUT", professional.cookie, {
      organizationName: "TEST ONLY professional",
      location: "Mumbai",
      description: "TEST ONLY practice",
      website: null,
      specialization,
      services: ["TEST ONLY services"],
      credentials: [{ name: "TEST ONLY private credential", isPublic: false }],
    });
    assert.equal(saved.status, 200);
    checks++;
    assert.equal(
      (
        (await (
          await request("/profiles/me", "GET", professional.cookie)
        ).json()) as any
      ).profile.specialization,
      specialization,
    );
    checks++;
  }
  assert.equal(
    (await request("/societies/me/opportunities", "GET", professional.cookie))
      .status,
    403,
  );
  checks++;
  const a = await account("SOCIETY", 1),
    b = await account("SOCIETY", 2),
    dev = await account("DEVELOPER", 1),
    pmc = await account("PMC", 1);
  for (const actor of [dev, pmc]) {
    const payload = {
      organizationName: `TEST ONLY ${actor.user.role} profile`,
      location: "Mumbai",
      officeLocation: "Mumbai",
      description: "TEST ONLY services",
      website: "https://company.example.invalid",
      publicEmail: "contact@example.invalid",
      areasServed: ["Mumbai"],
      locationsServed: ["Mumbai"],
      services: ["TEST ONLY consulting"],
      specializations: ["Redevelopment"],
      portfolio: [],
      credentials: [
        { name: "TEST ONLY private credential", isPublic: false },
        { name: "TEST ONLY public credential", isPublic: true },
      ],
      marketplaceVisible: true,
    };
    assert.equal(
      (await request("/profiles/me", "PUT", actor.cookie, payload)).status,
      200,
    );
    checks++;
    const owned = (
      (await (await request("/profiles/me", "GET", actor.cookie)).json()) as any
    ).profile;
    assert.equal(owned.organizationName, payload.organizationName);
    checks++;
    assert.equal(owned.credentials.length, 2);
    checks++;
    const visible = (
      (await (
        await request(
          `/marketplace/organizations/${actor.org.id}`,
          "GET",
          a.cookie,
        )
      ).json()) as any
    ).profile;
    assert.equal(visible.credentials.length, 1);
    checks++;
    assert.equal(visible.credentials[0].name, "TEST ONLY public credential");
    checks++;
    assert.equal(
      (
        await request(
          `/marketplace/organizations/${actor.org.id}`,
          "GET",
          pmc.cookie,
        )
      ).status,
      403,
    );
    checks++;
  }
  const token = issueAuthToken("PASSWORD_RESET");
  await db.insert(authTokens).values({
    userId: a.user.id,
    purpose: "PASSWORD_RESET",
    tokenHash: token.tokenHash,
    expiresAt: token.expiresAt,
  });
  const reset = await request("/auth/reset-password", "POST", "", {
    token: token.token,
    password: "new-password-test",
  });
  assert.equal(reset.status, 200);
  checks++;
  assert.equal((await request("/auth/me", "GET", a.cookie)).status, 401);
  checks++;
  assert.equal(
    (
      await request("/auth/login", "POST", "", {
        email: a.user.email,
        password: "old-password-test",
      })
    ).status,
    401,
  );
  checks++;
  assert.equal(
    (
      await request("/auth/reset-password", "POST", "", {
        token: token.token,
        password: "another-password",
      })
    ).status,
    400,
  );
  checks++;
  // Deterministic race interleaving: credentials read before reset, session insert after reset.
  let staleCookie = "";
  await createSession(
    db as never,
    a.user.id,
    {
      cookie(_name: string, value: string) {
        staleCookie = `renova_session=${value}`;
      },
    } as never,
    a.user.credentialVersion,
  );
  assert.equal((await request("/auth/me", "GET", staleCookie)).status, 401);
  checks++;
  const currentLogin = await request("/auth/login", "POST", "", {
    email: a.user.email,
    password: "new-password-test",
  });
  assert.equal(currentLogin.status, 200);
  checks++;
  a.cookie = currentLogin.headers.get("set-cookie")!.split(";")[0];
  const [updated] = await db
    .select()
    .from(users)
    .where(eq(users.id, a.user.id));
  assert.equal(
    verifyPassword("old-password-test", updated.passwordHash),
    false,
  );
  assert.equal(updated.credentialVersion, 1);
  checks++;
  const draft = {
    title: "TEST ONLY redevelopment",
    location: "Mumbai",
    description: "TEST ONLY private society brief for integration testing",
    publish: false,
  };
  const created = await request("/opportunities", "POST", a.cookie, draft);
  assert.equal(created.status, 201);
  const { opportunity } = (await created.json()) as any;
  checks++;
  assert.equal(
    (await request(`/opportunities/${opportunity.id}`, "GET", dev.cookie))
      .status,
    404,
  );
  checks++;
  for (const foreign of [b, dev, pmc]) {
    const expected = foreign === b ? 404 : 403;
    assert.equal(
      (
        await request(
          `/societies/me/opportunities/${opportunity.id}`,
          "GET",
          foreign.cookie,
        )
      ).status,
      expected,
    );
    assert.equal(
      (
        await request(
          `/societies/me/opportunities/${opportunity.id}`,
          "PATCH",
          foreign.cookie,
          { ...draft, publish: true },
        )
      ).status,
      expected,
    );
    checks += 2;
  }
  assert.equal(
    (await request(`/societies/me/opportunities/${opportunity.id}`)).status,
    401,
  );
  checks++;
  const saved = await request(
    `/societies/me/opportunities/${opportunity.id}`,
    "PATCH",
    a.cookie,
    { ...draft, title: "TEST ONLY edited draft" },
  );
  assert.equal(saved.status, 200);
  checks++;
  const reload = await request(
    `/societies/me/opportunities/${opportunity.id}`,
    "GET",
    a.cookie,
  );
  assert.equal(
    ((await reload.json()) as any).opportunity.title,
    "TEST ONLY edited draft",
  );
  checks++;
  assert.equal(
    (
      await request(
        `/societies/me/opportunities/${opportunity.id}/publish`,
        "POST",
        a.cookie,
        {},
      )
    ).status,
    200,
  );
  checks++;
  const published = await request(
    `/opportunities/${opportunity.id}`,
    "GET",
    dev.cookie,
  );
  const publicFields = ((await published.json()) as any).opportunity;
  assert.equal(published.status, 200);
  assert.equal("societyId" in publicFields, false);
  assert.equal("email" in publicFields, false);
  checks++;
  for (const actor of [dev, pmc])
    assert.equal(
      (
        await request(
          `/opportunities/${opportunity.id}/interests`,
          "POST",
          actor.cookie,
          {},
        )
      ).status,
      201,
    );
  checks += 2;
  const received = await request("/societies/me/interests", "GET", a.cookie);
  const receivedInterests = ((await received.json()) as any).interests;
  assert.equal(receivedInterests.length, 2);
  checks++;
  assert.equal(
    (
      await request(
        `/opportunities/${opportunity.id}/interests`,
        "POST",
        dev.cookie,
        {},
      )
    ).status,
    409,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/societies/me/opportunities/${opportunity.id}`,
        "PATCH",
        a.cookie,
        { title: "TEST ONLY published edit" },
      )
    ).status,
    409,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/societies/me/opportunities/${opportunity.id}/publish`,
        "POST",
        b.cookie,
        {},
      )
    ).status,
    404,
  );
  checks++;
  const devInterest = receivedInterests.find(
    (item: any) => item.role === "DEVELOPER",
  );
  assert.equal(
    (
      await request(
        `/societies/me/interests/${devInterest.id}`,
        "PATCH",
        b.cookie,
        { status: "SHORTLISTED" },
      )
    ).status,
    404,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/societies/me/interests/${devInterest.id}`,
        "PATCH",
        a.cookie,
        { status: "SHORTLISTED" },
      )
    ).status,
    200,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/organizations/me/interests/${devInterest.id}`,
        "DELETE",
        pmc.cookie,
      )
    ).status,
    404,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/organizations/me/interests/${devInterest.id}`,
        "DELETE",
        dev.cookie,
      )
    ).status,
    200,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/societies/me/interests/${devInterest.id}`,
        "PATCH",
        a.cookie,
        { status: "RECEIVED" },
      )
    ).status,
    409,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/organizations/me/interests/${devInterest.id}`,
        "DELETE",
        dev.cookie,
      )
    ).status,
    409,
  );
  checks++;
  const profile = {
    organizationName: "TEST ONLY society profile",
    location: "Mumbai",
    website: null,
    description: "Test organization description",
  };
  assert.equal(
    (await request("/profiles/me", "PUT", a.cookie, profile)).status,
    200,
  );
  checks++;
  const aProfile = await request("/profiles/me", "GET", a.cookie);
  assert.equal(
    ((await aProfile.json()) as any).profile.organizationName,
    profile.organizationName,
  );
  checks++;
  const bProfile = await request("/profiles/me", "GET", b.cookie);
  assert.notEqual(
    ((await bProfile.json()) as any).profile.organizationName,
    profile.organizationName,
  );
  checks++;
  assert.equal(
    (
      await request("/profiles/me", "PUT", a.cookie, {
        organizationName: "TEST ONLY society profile",
        address: "TEST ONLY address",
        city: "Mumbai",
        memberCount: 20,
        buildingAge: 40,
        redevelopmentStatus: "Considering redevelopment",
      })
    ).status,
    200,
  );
  checks++;
  assert.equal(
    (await request("/profiles/me", "PUT", pmc.cookie, {})).status,
    400,
  );
  checks++;
  const metric = await request("/workspace/metrics", "GET", a.cookie);
  assert.equal(((await metric.json()) as any).interests, 2);
  checks++;
  for (const actor of [dev, pmc]) {
    const interest = await request(
      "/organizations/me/interests",
      "GET",
      actor.cookie,
    );
    assert.equal(((await interest.json()) as any).interests.length, 1);
    checks++;
  }
  const details = {
    societyName: "TEST ONLY society",
    propertyAddress: "TEST ONLY property",
    locality: "Mumbai",
    city: "Mumbai",
    pinCode: "400001",
    contactPerson: "TEST ONLY contact",
    contactEmail: "society@example.invalid",
    contactPhone: "9000000000",
    propertyData: { unknownFields: ["plotArea"] },
  };
  const feasible = await request("/feasibility", "POST", a.cookie, details);
  assert.equal(feasible.status, 201);
  checks++;
  const feasibility = ((await feasible.json()) as any).request;
  assert.equal(feasibility.status, "DRAFT");
  checks++;
  assert.equal(feasibility.assessment, null);
  checks++;
  for (const actor of [b, dev, pmc]) {
    for (const [method, path, body] of [
      ["GET", `/feasibility/${feasibility.id}`, undefined],
      ["PUT", `/feasibility/${feasibility.id}`, details],
      ["POST", `/feasibility/${feasibility.id}/submit`, {}],
    ] as const) {
      assert.equal(
        (await request(path, method, actor.cookie, body)).status,
        actor === b ? 404 : 403,
      );
      checks++;
    }
  }
  assert.equal(
    (
      await request(`/feasibility/${feasibility.id}`, "PUT", a.cookie, {
        ...details,
        societyName: "TEST ONLY edited society",
      })
    ).status,
    200,
  );
  checks++;
  assert.equal(
    (
      (await (
        await request(`/feasibility/${feasibility.id}`, "GET", a.cookie)
      ).json()) as any
    ).request.societyName,
    "TEST ONLY edited society",
  );
  checks++;
  const submissions = await Promise.all([
    request(`/feasibility/${feasibility.id}/submit`, "POST", a.cookie, {}),
    request(`/feasibility/${feasibility.id}/submit`, "POST", a.cookie, {}),
  ]);
  assert.deepEqual(submissions.map((row) => row.status).sort(), [200, 409]);
  checks++;
  assert.equal(
    (await request(`/feasibility/${feasibility.id}`, "PUT", a.cookie, details))
      .status,
    409,
  );
  checks++;
  assert.deepEqual(
    ((await (await request("/feasibility/me", "GET", b.cookie)).json()) as any)
      .requests,
    [],
  );
  checks++;
  for (const actor of [a, dev, pmc]) {
    assert.equal(
      (
        await request(
          `/admin/feasibility/${feasibility.id}/status`,
          "PATCH",
          actor.cookie,
          { status: "IN_REVIEW" },
        )
      ).status,
      403,
    );
    checks++;
  }
  const [admin] = await db
    .insert(users)
    .values({
      email: "admin@example.invalid",
      displayName: "TEST ONLY admin",
      role: "ADMIN",
      passwordHash: hashPassword("test-admin-password"),
      emailVerifiedAt: new Date(),
    })
    .returning();
  let adminCookie = "";
  await createSession(
    db as never,
    admin.id,
    {
      cookie(_name: string, value: string) {
        adminCookie = `renova_session=${value}`;
      },
    } as never,
    0,
  );
  for (const payload of [
    { status: "IN_REVIEW" },
    {
      status: "MORE_INFORMATION_REQUIRED",
      missingInformation: "TEST ONLY request more documents",
    },
  ]) {
    assert.equal(
      (
        await request(
          `/admin/feasibility/${feasibility.id}/status`,
          "PATCH",
          adminCookie,
          payload,
        )
      ).status,
      200,
    );
    checks++;
  }
  const responseDraft = await request(
    `/feasibility/${feasibility.id}`,
    "PUT",
    a.cookie,
    details,
  );
  assert.equal(responseDraft.status, 200);
  checks++;
  assert.equal(
    ((await responseDraft.json()) as any).request.status,
    "MORE_INFORMATION_REQUIRED",
  );
  checks++;
  assert.ok(
    (
      (await (
        await request("/admin/feasibility", "GET", adminCookie)
      ).json()) as any
    ).requests.some((row: any) => row.id === feasibility.id),
  );
  checks++;
  assert.equal(
    (
      await request(
        `/feasibility/${feasibility.id}/submit`,
        "POST",
        a.cookie,
        {},
      )
    ).status,
    200,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/admin/feasibility/${feasibility.id}/status`,
        "PATCH",
        adminCookie,
        { status: "IN_REVIEW" },
      )
    ).status,
    200,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/admin/feasibility/${feasibility.id}/publish`,
        "POST",
        adminCookie,
        {},
      )
    ).status,
    409,
  );
  checks++;
  assert.equal(
    (
      await request(
        `/admin/feasibility/${feasibility.id}/assessment`,
        "PUT",
        adminCookie,
        {
          professionalNotes:
            "TEST ONLY professional assessment; no invented conclusions",
          assumptions: [],
          documentsReviewed: [],
        },
      )
    ).status,
    200,
  );
  checks++;
  assert.equal(
    (
      (await (
        await request(`/feasibility/${feasibility.id}`, "GET", a.cookie)
      ).json()) as any
    ).request.assessment,
    null,
  );
  checks++;
  const publications = await Promise.all([
    request(
      `/admin/feasibility/${feasibility.id}/publish`,
      "POST",
      adminCookie,
      {},
    ),
    request(
      `/admin/feasibility/${feasibility.id}/publish`,
      "POST",
      adminCookie,
      {},
    ),
  ]);
  assert.deepEqual(publications.map((row) => row.status).sort(), [200, 409]);
  checks++;
  const finalResult = (
    (await (
      await request(`/feasibility/${feasibility.id}`, "GET", a.cookie)
    ).json()) as any
  ).request;
  assert.equal(finalResult.status, "ASSESSMENT_READY");
  checks++;
  assert.equal(
    finalResult.assessment.professionalNotes,
    "TEST ONLY professional assessment; no invented conclusions",
  );
  checks++;
  assert.deepEqual(
    finalResult.history.map((row: any) => row.toStatus),
    [
      "DRAFT",
      "SUBMITTED",
      "IN_REVIEW",
      "MORE_INFORMATION_REQUIRED",
      "SUBMITTED",
      "IN_REVIEW",
      "ASSESSMENT_READY",
    ],
  );
  checks++;
  const enquiry = await request("/enquiries", "POST", "", {
    name: "TEST ONLY person",
    organizationName: "TEST ONLY society",
    email: "enquiry@example.invalid",
    phone: "9000000000",
    city: "Mumbai",
    actorType: "Housing Society",
    message: "TEST ONLY request for controlled beta testing",
    consent: true,
  });
  assert.equal(enquiry.status, 201);
  checks++;
  assert.equal((await db.select().from(enquiries)).length, 1);
  checks++;
  assert.equal(
    (await request("/admin/enquiries", "GET", dev.cookie)).status,
    403,
  );
  checks++;
  const adminEnquiries = await request("/admin/enquiries", "GET", adminCookie);
  assert.equal(((await adminEnquiries.json()) as any).enquiries.length, 1);
  checks++;
  for (const purpose of ["EMAIL_VERIFICATION", "PASSWORD_RESET"] as const) {
    const expired = issueAuthToken(purpose);
    await db.insert(authTokens).values({
      userId: dev.user.id,
      purpose,
      tokenHash: expired.tokenHash,
      expiresAt: new Date(Date.now() - 1000),
    });
    const endpoint =
      purpose === "PASSWORD_RESET"
        ? "/auth/reset-password"
        : "/auth/verify-email";
    assert.equal(
      (
        await request(endpoint, "POST", "", {
          token: expired.token,
          password: "test-new-password",
        })
      ).status,
      400,
    );
    checks++;
    assert.equal(
      (
        await request(endpoint, "POST", "", {
          token: "x".repeat(43),
          password: "test-new-password",
        })
      ).status,
      400,
    );
    checks++;
  }
  // Multiple existing sessions are invalidated; fresh credentials can log in afterward.
  const second = await request("/auth/login", "POST", "", {
    email: dev.user.email,
    password: "old-password-test",
  });
  const secondCookie = second.headers.get("set-cookie")!.split(";")[0];
  const concurrentToken = issueAuthToken("PASSWORD_RESET");
  await db.insert(authTokens).values({
    userId: dev.user.id,
    purpose: "PASSWORD_RESET",
    tokenHash: concurrentToken.tokenHash,
    expiresAt: concurrentToken.expiresAt,
  });
  const [duringLogin, duringReset] = await Promise.all([
    request("/auth/login", "POST", "", {
      email: dev.user.email,
      password: "old-password-test",
    }),
    request("/auth/reset-password", "POST", "", {
      token: concurrentToken.token,
      password: "concurrent-new-password",
    }),
  ]);
  assert.equal(duringReset.status, 200);
  checks++;
  for (const cookie of [
    dev.cookie,
    secondCookie,
    duringLogin.headers.get("set-cookie")?.split(";")[0],
  ].filter(Boolean)) {
    assert.equal((await request("/auth/me", "GET", cookie!)).status, 401);
    checks++;
  }
  assert.equal(
    (
      await request("/auth/login", "POST", "", {
        email: dev.user.email,
        password: "concurrent-new-password",
      })
    ).status,
    200,
  );
  checks++;
  for (const role of ["SOCIETY", "DEVELOPER", "PMC"] as const) {
    const [unverified] = await db
      .insert(users)
      .values({
        email: `unverified-${role.toLowerCase()}@example.invalid`,
        displayName: "TEST ONLY verification",
        role,
        passwordHash: hashPassword("verification-password"),
        isActive: false,
      })
      .returning();
    assert.equal(
      (
        await request("/auth/login", "POST", "", {
          email: unverified.email,
          password: "verification-password",
        })
      ).status,
      401,
    );
    checks++;
    const verification = issueEmailOtp(unverified.id);
    let legacyCookie = "";
    await createSession(
      db as never,
      unverified.id,
      {
        cookie(_name: string, value: string) {
          legacyCookie = `renova_session=${value}`;
        },
      } as never,
      0,
    );
    await db.insert(authTokens).values({
      userId: unverified.id,
      purpose: "EMAIL_VERIFICATION",
      tokenHash: verification.tokenHash,
      expiresAt: verification.expiresAt,
    });
    assert.equal(
      (
        await request("/auth/verify-email", "POST", "", {
          email: unverified.email,
          otp: verification.otp,
        })
      ).status,
      200,
    );
    checks++;
    assert.equal((await request("/auth/me", "GET", legacyCookie)).status, 401);
    checks++;
    assert.equal(
      (
        await request("/auth/verify-email", "POST", "", {
          email: unverified.email,
          otp: verification.otp,
        })
      ).status,
      400,
    );
    checks++;
    assert.equal(
      (
        await request("/auth/login", "POST", "", {
          email: unverified.email,
          password: "verification-password",
        })
      ).status,
      200,
    );
    checks++;
  }
  const disabled = await account("DEVELOPER", 42);
  await db
    .update(users)
    .set({ isActive: false })
    .where(eq(users.id, disabled.user.id));
  const oldVerification = issueEmailOtp(disabled.user.id);
  await db.insert(authTokens).values({
    userId: disabled.user.id,
    purpose: "EMAIL_VERIFICATION",
    tokenHash: oldVerification.tokenHash,
    expiresAt: oldVerification.expiresAt,
  });
  assert.equal(
    (
      await request("/auth/verify-email", "POST", "", {
        email: disabled.user.email,
        otp: oldVerification.otp,
      })
    ).status,
    400,
    "verification must not reactivate a verified disabled account",
  );
  checks++;
  const [stillDisabled] = await db
    .select()
    .from(users)
    .where(eq(users.id, disabled.user.id));
  assert.equal(stillDisabled.isActive, false);
  checks++;
  assert.equal((await request("/auth/me", "GET", disabled.cookie)).status, 401);
  checks++;
  assert.equal(
    (
      await request("/auth/login", "POST", "", {
        email: disabled.user.email,
        password: "old-password-test",
      })
    ).status,
    401,
  );
  checks++;
  // Prompt L — standard tier, feasibility quotas, reset-password limit.
  // Document uploads go through the @vercel/blob stub (tests/blob-stub.ts),
  // so no real Blob object is ever written; the stub's putCalls prove it.
  const previousBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = "test-only-blob-token";
  const pdf = Buffer.from("%PDF-1.4\nTEST ONLY document\n");
  async function uploadDocument(
    targetOrigin: string,
    cookie: string,
    requestId: string,
    body: Buffer,
    contentType = "application/pdf",
    ip?: string,
  ) {
    return fetch(
      targetOrigin +
        `/api/feasibility/${requestId}/documents?fileName=${encodeURIComponent("test-only.pdf")}&category=${encodeURIComponent("TEST ONLY")}`,
      {
        method: "POST",
        headers: {
          "content-type": contentType,
          cookie,
          ...(ip ? { "x-forwarded-for": ip } : {}),
        },
        body,
      },
    );
  }
  async function miniRequest(
    path: string,
    method = "GET",
    cookie = "",
    body?: unknown,
    ip?: string,
  ) {
    return fetch(miniOrigin + "/api" + path, {
      method,
      headers: {
        "content-type": "application/json",
        cookie,
        ...(ip ? { "x-forwarded-for": ip } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async function seedRateLimitBucket(
    action: string,
    subject: string,
    count: number,
  ) {
    // Seed both the current minute and the next, so the test survives a
    // minute-boundary rollover between seeding and requesting. The upsert
    // matters for the global bucket, which earlier mini-app requests have
    // already incremented in the current window.
    const now = new Date();
    const windowMs = 60 * 1000;
    for (const offset of [0, windowMs]) {
      await db
        .insert(authRateLimits)
        .values({
          action,
          subjectHash: subject,
          windowStartedAt: rateLimitWindowStart(
            new Date(now.getTime() + offset),
            windowMs,
          ),
          requestCount: count,
        })
        .onConflictDoUpdate({
          target: [
            authRateLimits.action,
            authRateLimits.subjectHash,
            authRateLimits.windowStartedAt,
          ],
          set: { requestCount: count },
        });
    }
  }
  // Task 1 (F6, request half) — a society may create 5 feasibility requests
  // a day; the 6th is refused and creates nothing.
  const q = await account("SOCIETY", 90);
  const [qSociety] = await db
    .select()
    .from(societies)
    .where(eq(societies.organizationId, q.org.id));
  for (let i = 1; i <= 5; i++) {
    assert.equal(
      (await request("/feasibility", "POST", q.cookie, details)).status,
      201,
      `feasibility create ${i} of 5`,
    );
    checks++;
  }
  assert.equal(
    (await request("/feasibility", "POST", q.cookie, details)).status,
    429,
    "the 6th feasibility request in a day is refused",
  );
  checks++;
  assert.equal(
    (
      await db
        .select()
        .from(feasibilityRequests)
        .where(eq(feasibilityRequests.societyId, qSociety.id))
    ).length,
    5,
    "a refused feasibility create writes no row",
  );
  checks++;
  // Task 3 (F6, document half) + Task 4 upload-guard re-checks. The guard
  // refusals run first: they happen before the quota check, so an invalid
  // upload consumes no quota.
  const d = await account("SOCIETY", 91);
  resetPutCalls();
  const docFeasible = await request("/feasibility", "POST", d.cookie, details);
  assert.equal(docFeasible.status, 201);
  checks++;
  const docRequest = ((await docFeasible.json()) as any).request;
  // PNG declared, PDF bytes inside: the magic-byte check refuses it.
  assert.equal(
    (await uploadDocument(origin, d.cookie, docRequest.id, pdf, "image/png"))
      .status,
    400,
  );
  checks++;
  // A type outside the allowlist is refused before the body is read.
  assert.equal(
    (
      await uploadDocument(
        origin,
        d.cookie,
        docRequest.id,
        Buffer.from("plain text"),
        "text/plain",
      )
    ).status,
    415,
  );
  checks++;
  // Over the 10 MB per-file limit.
  assert.equal(
    (
      await uploadDocument(
        origin,
        d.cookie,
        docRequest.id,
        Buffer.concat([pdf, Buffer.alloc(10 * 1024 * 1024)]),
      )
    ).status,
    413,
  );
  checks++;
  assert.equal(putCalls.length, 0, "refused uploads wrote no Blob object");
  checks++;
  // A valid upload lands in private Blob storage with its SHA-256 recorded.
  assert.equal(
    (await uploadDocument(origin, d.cookie, docRequest.id, pdf)).status,
    201,
  );
  checks++;
  assert.equal(putCalls.length, 1);
  checks++;
  assert.equal(putCalls[0].access, "private");
  checks++;
  const [firstDoc] = await db
    .select()
    .from(feasibilityDocuments)
    .where(eq(feasibilityDocuments.requestId, docRequest.id));
  assert.equal(
    firstDoc.checksumSha256,
    createHash("sha256").update(pdf).digest("hex"),
  );
  checks++;
  // Uploads 2–8 succeed; the count after 8 proves the rows land.
  for (let i = 2; i <= 8; i++) {
    assert.equal(
      (await uploadDocument(origin, d.cookie, docRequest.id, pdf)).status,
      201,
      `document upload ${i} of 20`,
    );
    checks++;
  }
  assert.equal(
    (
      await db
        .select()
        .from(feasibilityDocuments)
        .where(eq(feasibilityDocuments.requestId, docRequest.id))
    ).length,
    8,
    "document count after 8 uploads",
  );
  checks++;
  assert.equal(putCalls.length, 8, "Blob put calls after 8 uploads");
  checks++;
  // Uploads 9–20 succeed; the 21st is refused and writes nothing.
  for (let i = 9; i <= 20; i++) {
    assert.equal(
      (await uploadDocument(origin, d.cookie, docRequest.id, pdf)).status,
      201,
      `document upload ${i} of 20`,
    );
    checks++;
  }
  assert.equal(
    (await uploadDocument(origin, d.cookie, docRequest.id, pdf)).status,
    429,
    "the 21st document on one request is refused",
  );
  checks++;
  assert.equal(
    (
      await db
        .select()
        .from(feasibilityDocuments)
        .where(eq(feasibilityDocuments.requestId, docRequest.id))
    ).length,
    20,
    "a refused upload writes no row",
  );
  checks++;
  assert.equal(putCalls.length, 20, "a refused upload writes no Blob object");
  checks++;
  // The 21st refusal above comes from the daily burst bucket. Prove the
  // hard count cap binds on its own: empty the burst bucket and try again —
  // the bucket allows it, the count (20 of 20) still refuses it.
  await db
    .delete(authRateLimits)
    .where(
      and(
        eq(authRateLimits.action, "FEASIBILITY_DOCUMENT"),
        eq(
          authRateLimits.subjectHash,
          authRateLimitSubject("feasibility-request", docRequest.id),
        ),
      ),
    );
  assert.equal(
    (await uploadDocument(origin, d.cookie, docRequest.id, pdf)).status,
    429,
    "the count cap refuses a 21st document even with a fresh burst bucket",
  );
  checks++;
  assert.equal(putCalls.length, 20);
  checks++;
  // The cap is per request, not per society: a second request for the same
  // society accepts a document.
  const secondFeasible = await request(
    "/feasibility",
    "POST",
    d.cookie,
    details,
  );
  assert.equal(secondFeasible.status, 201);
  checks++;
  const secondRequest = ((await secondFeasible.json()) as any).request;
  assert.equal(
    (await uploadDocument(origin, d.cookie, secondRequest.id, pdf)).status,
    201,
  );
  checks++;
  // Task 1 — the standard tier, on the mini-app (production router
  // composition, trust proxy on). Each test uses its own TEST-NET-3 client
  // IP so the per-IP buckets never leak between tests.
  const reg = await account("SOCIETY", 92);
  const standardIp = "203.0.113.10";
  // Regression happy path: login, create a feasibility request, upload a
  // document — all succeed under the new limits.
  const miniLogin = await miniRequest(
    "/auth/login",
    "POST",
    "",
    { email: reg.user.email, password: "old-password-test" },
    standardIp,
  );
  assert.equal(miniLogin.status, 200);
  checks++;
  const miniCookie = miniLogin.headers.get("set-cookie")!.split(";")[0];
  const miniFeasible = await miniRequest(
    "/feasibility",
    "POST",
    miniCookie,
    details,
    standardIp,
  );
  assert.equal(miniFeasible.status, 201);
  checks++;
  const miniRequestId = ((await miniFeasible.json()) as any).request.id;
  assert.equal(
    (
      await uploadDocument(
        miniOrigin,
        miniCookie,
        miniRequestId,
        pdf,
        "application/pdf",
        standardIp,
      )
    ).status,
    201,
  );
  checks++;
  // Per-IP cap: seed the IP bucket to 99 for this minute and the next, so
  // the next request is the 100th (allowed) and the one after is refused.
  const cappedIp = "203.0.113.11";
  await seedRateLimitBucket(
    "STANDARD_REQUEST",
    authRateLimitSubject(cappedIp, "*"),
    99,
  );
  assert.equal(
    (await miniRequest("/auth/me", "GET", reg.cookie, undefined, cappedIp))
      .status,
    200,
  );
  checks++;
  assert.equal(
    (await miniRequest("/auth/me", "GET", reg.cookie, undefined, cappedIp))
      .status,
    429,
    "the 101st request from one IP in a minute is refused",
  );
  checks++;
  // A different IP is unaffected by the first IP's cap.
  assert.equal(
    (
      await miniRequest(
        "/auth/me",
        "GET",
        reg.cookie,
        undefined,
        "203.0.113.12",
      )
    ).status,
    200,
  );
  checks++;
  // Reset-password limit: the same wrong token 6 times — the first five are
  // refused as invalid tokens (400), the sixth hits the per-token bucket.
  const resetIp = "203.0.113.31";
  const wrongToken = "0".repeat(64);
  for (let i = 1; i <= 5; i++) {
    assert.equal(
      (
        await miniRequest(
          "/auth/reset-password",
          "POST",
          "",
          { token: wrongToken, password: "new-password-test" },
          resetIp,
        )
      ).status,
      400,
      `wrong reset token attempt ${i} of 5`,
    );
    checks++;
  }
  assert.equal(
    (
      await miniRequest(
        "/auth/reset-password",
        "POST",
        "",
        { token: wrongToken, password: "new-password-test" },
        resetIp,
      )
    ).status,
    429,
    "the 6th reset attempt for one token is refused",
  );
  checks++;
  // Per-IP bucket: 51 distinct wrong tokens — the 51st hits the per-IP cap.
  const resetFloodIp = "203.0.113.32";
  // Tokens start at 1, not 0: String(0).padStart(64, "0") is the all-zeros
  // token the per-token test above already exhausted (5 uses + 1 refusal),
  // so reusing it here would trip the per-token bucket instead of proving
  // the per-IP bucket. Tokens 1..50 are all distinct from it.
  for (let i = 0; i < 50; i++) {
    assert.equal(
      (
        await miniRequest(
          "/auth/reset-password",
          "POST",
          "",
          {
            token: String(i + 1).padStart(64, "0"),
            password: "new-password-test",
          },
          resetFloodIp,
        )
      ).status,
      400,
      `distinct wrong reset token ${i + 1} of 50`,
    );
    checks++;
  }
  assert.equal(
    (
      await miniRequest(
        "/auth/reset-password",
        "POST",
        "",
        { token: "9".repeat(64), password: "new-password-test" },
        resetFloodIp,
      )
    ).status,
    429,
    "the 51st reset attempt from one IP is refused",
  );
  checks++;
  // Logout is deliberately NOT rate-limited (clearSession only deletes the
  // presented session): three logouts in a row all succeed.
  const logoutIp = "203.0.113.33";
  for (let i = 1; i <= 3; i++) {
    assert.equal(
      (await miniRequest("/auth/logout", "POST", reg.cookie, {}, logoutIp))
        .status,
      204,
      `logout ${i} of 3`,
    );
    checks++;
  }
  // Global cap, LAST: with the global bucket seeded to 999, a request from
  // one IP is the 1000th (allowed) and a request from a different IP — IP
  // rotation — is refused. After this the global bucket is full, so no
  // further mini-app request may follow.
  await seedRateLimitBucket(
    "STANDARD_REQUEST_GLOBAL",
    authRateLimitSubject("global", "standard"),
    999,
  );
  assert.equal(
    (
      await miniRequest(
        "/auth/me",
        "GET",
        miniCookie,
        undefined,
        "203.0.113.13",
      )
    ).status,
    200,
  );
  checks++;
  assert.equal(
    (
      await miniRequest(
        "/auth/me",
        "GET",
        miniCookie,
        undefined,
        "203.0.113.14",
      )
    ).status,
    429,
    "IP rotation does not beat the global cap",
  );
  checks++;
  if (previousBlobToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = previousBlobToken;
  checks += await testAuthDelivery(origin);
  const concurrentEnquiries = await Promise.all(
    Array.from({ length: 8 }, () =>
      request("/enquiries", "POST", "", {
        name: "TEST ONLY concurrent enquiry",
        organizationName: "TEST ONLY society",
        email: "concurrent-enquiry@example.invalid",
        phone: "9000000000",
        city: "Mumbai",
        actorType: "Housing Society",
        message: "TEST ONLY rate-limit regression",
        consent: true,
      }),
    ),
  );
  assert.equal(
    concurrentEnquiries.filter((row) => row.status === 201).length,
    5,
    "concurrent enquiries must not exceed five submissions per fingerprint/hour",
  );
  checks++;
  assert.equal(
    concurrentEnquiries.filter((row) => row.status === 429).length,
    3,
  );
  checks++;
  assert.equal(
    (
      await db
        .select()
        .from(enquiries)
        .where(eq(enquiries.email, "concurrent-enquiry@example.invalid"))
    ).length,
    5,
  );
  checks++;
  checks += await testSandboxAndEmail(
    origin,
    a.cookie,
    b.cookie,
    pmc.cookie,
    adminCookie,
  );
  assert.equal((await request("/auth/me", "GET", pmc.cookie)).status, 200);
  checks++;
  await db
    .update(authSessions)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(authSessions.userId, pmc.user.id));
  assert.equal((await request("/auth/me", "GET", pmc.cookie)).status, 401);
  checks++;
  assert.equal((await request("/auth/me", "GET", a.cookie)).status, 200);
  checks++;
  assert.equal(
    (await request("/auth/logout", "POST", a.cookie, {})).status,
    204,
  );
  checks++;
  assert.equal((await request("/auth/me", "GET", a.cookie)).status, 401);
  checks++;
  console.log(
    `PASS: ${checks} database-backed auth/draft/authorization assertions (isolated PostgreSQL/PGlite).`,
  );
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await new Promise<void>((resolve) => miniServer.close(() => resolve()));
  await engine.close();
  if (previousOtpSecret === undefined)
    delete process.env.RENOVA_AUTH_TOKEN_SECRET;
  else process.env.RENOVA_AUTH_TOKEN_SECRET = previousOtpSecret;
}
