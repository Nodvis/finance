import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/session", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {
    constructor() {
      super("Authentication is required");
      this.name = "AuthenticationRequiredError";
    }
  },
}));

vi.mock("@/lib/authorization/household", () => ({
  HouseholdAccessDeniedError: class HouseholdAccessDeniedError extends Error {
    constructor() {
      super("Household access denied");
      this.name = "HouseholdAccessDeniedError";
    }
  },
  requireHouseholdAccess: vi.fn(),
}));

vi.mock("@/lib/statement-imports/service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/statement-imports/service")>();
  return {
    ...actual,
    createImportProfile: vi.fn(),
    listImportProfiles: vi.fn(),
    getImportProfile: vi.fn(),
    updateImportProfile: vi.fn(),
    deleteImportProfile: vi.fn(),
  };
});

import { AuthenticationRequiredError } from "@/lib/auth/session";
import {
  HouseholdAccessDeniedError,
  requireHouseholdAccess,
} from "@/lib/authorization/household";
import {
  DuplicateStatementImportProfileNameError,
  StatementImportProfileNotFoundError,
  createImportProfile,
  deleteImportProfile,
  getImportProfile,
  listImportProfiles,
  updateImportProfile,
} from "@/lib/statement-imports/service";

import {
  GET as listProfilesHandler,
  POST as createProfileHandler,
} from "./route";
import {
  DELETE as deleteProfileHandler,
  GET as getProfileHandler,
  PATCH as updateProfileHandler,
} from "./[profileId]/route";

const validHousehold = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const validAccount = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const validProfileId = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";

const testAccess = {
  authUserId: "user-1",
  householdId: validHousehold,
  personId: "person-1",
};

const sampleMapping = {
  dateColumn: "Data",
  dateFormat: "auto" as const,
  timezone: "UTC",
  amountMode: "signed" as const,
  amountColumn: "Kwota",
  invertAmount: false,
  currencyMode: "account" as const,
  descriptionColumn: "Tytuł",
  delimiter: ";" as const,
  hasHeader: true,
  headerRowIndex: 0,
  skipLeadingRows: 0,
};

describe("Statement import profile API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /profiles", () => {
    it("denies access if unauthenticated", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValue(
        new AuthenticationRequiredError(),
      );

      const req = new Request("http://localhost/profiles");
      const res = await listProfilesHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
        }),
      });

      expect(res.status).toBe(401);
    });

    it("denies access if forbidden (403)", async () => {
      vi.mocked(requireHouseholdAccess).mockRejectedValue(
        new HouseholdAccessDeniedError(),
      );

      const req = new Request("http://localhost/profiles");
      const res = await listProfilesHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
        }),
      });

      expect(res.status).toBe(403);
    });

    it("returns list of mapping profiles", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      vi.mocked(listImportProfiles).mockResolvedValue([
        {
          id: validProfileId,
          householdId: validHousehold,
          accountId: validAccount,
          name: "mBank CSV",
          mappingConfig: sampleMapping,
          autoProcessSafe: true,
          isDefault: true,
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T00:00:00.000Z",
        },
      ]);

      const req = new Request("http://localhost/profiles");
      const res = await listProfilesHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].name).toBe("mBank CSV");
    });
  });

  describe("POST /profiles", () => {
    it("returns a stable JSON validation error for malformed JSON", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);

      const res = await createProfileHandler(new Request("http://localhost/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      }), { params: Promise.resolve({ householdId: validHousehold, accountId: validAccount }) });

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({ code: "JSON_INVALID" });
    });

    it("creates a mapping profile successfully (201)", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      vi.mocked(createImportProfile).mockResolvedValue({
        id: validProfileId,
        householdId: validHousehold,
        accountId: validAccount,
        name: "New Profile",
        mappingConfig: sampleMapping,
        autoProcessSafe: true,
        isDefault: false,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      });

      const req = new Request("http://localhost/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Profile",
          mappingConfig: sampleMapping,
          autoProcessSafe: true,
          isDefault: false,
        }),
      });

      const res = await createProfileHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.name).toBe("New Profile");
      expect(json.data.autoProcessSafe).toBe(true);
    });

    it("returns 400 on invalid input", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);

      const req = new Request("http://localhost/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "",
          mappingConfig: sampleMapping,
        }),
      });

      const res = await createProfileHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 409 on duplicate profile name", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      vi.mocked(createImportProfile).mockRejectedValue(
        new DuplicateStatementImportProfileNameError(),
      );

      const req = new Request("http://localhost/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Existing Profile",
          mappingConfig: sampleMapping,
        }),
      });

      const res = await createProfileHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
        }),
      });

      expect(res.status).toBe(409);
    });
  });

  describe("GET /profiles/[profileId]", () => {
    it("returns profile by id", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      vi.mocked(getImportProfile).mockResolvedValue({
        id: validProfileId,
        householdId: validHousehold,
        accountId: validAccount,
        name: "Profile By ID",
        mappingConfig: sampleMapping,
        autoProcessSafe: false,
        isDefault: false,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      });

      const req = new Request(`http://localhost/profiles/${validProfileId}`);
      const res = await getProfileHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
          profileId: validProfileId,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.name).toBe("Profile By ID");
    });

    it("returns 404 when profile not found", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      vi.mocked(getImportProfile).mockRejectedValue(
        new StatementImportProfileNotFoundError(),
      );

      const req = new Request(`http://localhost/profiles/${validProfileId}`);
      const res = await getProfileHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
          profileId: validProfileId,
        }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /profiles/[profileId]", () => {
    it("returns a stable JSON validation error for malformed JSON", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);

      const res = await updateProfileHandler(new Request(`http://localhost/profiles/${validProfileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      }), { params: Promise.resolve({ householdId: validHousehold, accountId: validAccount, profileId: validProfileId }) });

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({ code: "JSON_INVALID" });
    });

    it("updates profile fields", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      vi.mocked(updateImportProfile).mockResolvedValue({
        id: validProfileId,
        householdId: validHousehold,
        accountId: validAccount,
        name: "Updated Name",
        mappingConfig: sampleMapping,
        autoProcessSafe: true,
        isDefault: true,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      });

      const req = new Request(`http://localhost/profiles/${validProfileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Name",
          autoProcessSafe: true,
        }),
      });

      const res = await updateProfileHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
          profileId: validProfileId,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.name).toBe("Updated Name");
      expect(json.data.autoProcessSafe).toBe(true);
    });
  });

  describe("DELETE /profiles/[profileId]", () => {
    it("deletes profile and returns success", async () => {
      vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
      vi.mocked(deleteImportProfile).mockResolvedValue(true);

      const req = new Request(`http://localhost/profiles/${validProfileId}`, {
        method: "DELETE",
      });

      const res = await deleteProfileHandler(req, {
        params: Promise.resolve({
          householdId: validHousehold,
          accountId: validAccount,
          profileId: validProfileId,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  it("returns 409 when an account route targets a household-global profile", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
    vi.mocked(updateImportProfile).mockRejectedValue(Object.assign(new Error(), { name: "StatementImportProfileScopeConflictError" }));

    const res = await updateProfileHandler(new Request(`http://localhost/profiles/${validProfileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Renamed" }),
    }), { params: Promise.resolve({ householdId: validHousehold, accountId: validAccount, profileId: validProfileId }) });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "STATEMENT_IMPORT_PROFILE_SCOPE_CONFLICT",
      code: "STATEMENT_IMPORT_PROFILE_SCOPE_CONFLICT",
    });
  });

  it("returns 409 when an account route tries to delete a household-global profile", async () => {
    vi.mocked(requireHouseholdAccess).mockResolvedValue(testAccess as any);
    vi.mocked(deleteImportProfile).mockRejectedValue(Object.assign(new Error(), { name: "StatementImportProfileScopeConflictError" }));

    const res = await deleteProfileHandler(new Request(`http://localhost/profiles/${validProfileId}`, {
      method: "DELETE",
    }), { params: Promise.resolve({ householdId: validHousehold, accountId: validAccount, profileId: validProfileId }) });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "STATEMENT_IMPORT_PROFILE_SCOPE_CONFLICT",
      code: "STATEMENT_IMPORT_PROFILE_SCOPE_CONFLICT",
    });
  });
});
