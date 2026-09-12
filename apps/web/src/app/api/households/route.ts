import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  InstanceAlreadyInitializedError,
  createHouseholdOnboarding,
  listHouseholdsForAuthUser,
} from "@nodvis/finance-db";
import {
  AuthenticationRequiredError,
  requireCurrentSession,
} from "@/lib/auth/session";
import { ACTIVE_HOUSEHOLD_COOKIE_NAME } from "@/lib/authorization/household";

const createHouseholdOnboardingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Household name is required")
    .max(160, "Household name cannot exceed 160 characters"),
  defaultCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Default currency must be a 3-letter uppercase code"),
  personDisplayName: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .optional(),
  bootstrap: z.boolean().optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireCurrentSession();
    const households = await listHouseholdsForAuthUser(session.user.id);
    return NextResponse.json({ data: households }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: "Authentication is required" },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireCurrentSession();
    const body = await request.json();
    const parsed = createHouseholdOnboardingSchema.parse(body);

    const created = await createHouseholdOnboarding({
      authUserId: session.user.id,
      householdName: parsed.name,
      defaultCurrency: parsed.defaultCurrency,
      personDisplayName: parsed.personDisplayName,
      bootstrap: parsed.bootstrap,
    });

    const response = NextResponse.json({ data: created }, { status: 201 });
    response.cookies.set(ACTIVE_HOUSEHOLD_COOKIE_NAME, created.householdId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: "Authentication is required" },
        { status: 401 },
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof InstanceAlreadyInitializedError) {
      return NextResponse.json(
        { error: "Instance setup has already been completed" },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message.includes("Invalid")) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
