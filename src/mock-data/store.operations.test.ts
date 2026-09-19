import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/services/api-client";
import { getAuthToken, setAuthToken } from "@/services/auth-token";
import { readSession } from "@/services/jwt";
import {
  mockChangeUserRole,
  mockConfirmRefunded,
  mockCreateProduct,
  mockCreateQuotation,
  mockCreateOrderFromQuotation,
  mockCreateUser,
  mockDeactivateUser,
  mockDeriveAvailability,
  mockForfeit,
  mockGetCustomerCreditBalance,
  mockGetDashboard,
  mockGetDepositByOrder,
  mockGetOrder,
  mockGetQuotation,
  mockIssueCreditNote,
  mockListCreditNotesByCustomer,
  mockListNotifications,
  mockListNotificationsBySubject,
  mockListProducts,
  mockListStockMovementsByOrder,
  mockListUsers,
  mockLogin,
  mockRecordStockMovement,
  mockRequestRefund,
  mockResetUserPassword,
  resetMockData,
} from "@/mock-data/store";
import {
  DEMO_PASSWORD,
  SEED_CREDIT_NOTES,
  SEED_CUSTOMERS,
  SEED_DEPOSITS,
  SEED_NOTIFICATIONS,
  SEED_ORDERS,
  SEED_ORDER_DETAILS,
  SEED_PRODUCTS,
  SEED_QUOTATION_DETAILS,
  SEED_STOCK_MOVEMENTS,
  SEED_USERS,
} from "@/mock-data/seed";

/**
 * Everything the store does outside the master-data CRUD covered in
 * store.crud.test.ts: authentication, products, users, deposits, credit notes,
 * notifications, reporting, availability and the per-record lookups.
 *
 * Unlike that file, several of these paths read the caller out of the stored
 * token, so they sign in first through mockLogin rather than faking a session.
 * That is the same path the app takes, which is the point of minting a real
 * token shape in the mock at all.
 */

const onlyActiveAdmin = SEED_USERS.find((user) => user.active && user.role === "ADMIN")!;
const activeNonAdmin = SEED_USERS.find((user) => user.active && user.role !== "ADMIN")!;
const inactiveUser = SEED_USERS.find((user) => !user.active)!;

const heldDeposit = SEED_DEPOSITS.find((deposit) => deposit.status === "HELD")!;
const secondHeldDeposit = SEED_DEPOSITS.filter((deposit) => deposit.status === "HELD")[1]!;
const pendingDeposit = SEED_DEPOSITS.find((deposit) => deposit.status === "REFUND_PENDING")!;
const settledDeposit = SEED_DEPOSITS.find((deposit) => deposit.status === "REFUNDED")!;

const inactiveProduct = SEED_PRODUCTS.find((product) => !product.active)!;
const activeProduct = SEED_PRODUCTS.find((product) => product.active)!;

/** The customer two seeded credit notes were issued to. */
const creditCustomer = SEED_CUSTOMERS.find(
  (customer) =>
    SEED_CREDIT_NOTES.filter((note) => note.customerId === customer.id).length > 1,
)!;

const orderWithMovements = SEED_ORDER_DETAILS.find((order) =>
  SEED_STOCK_MOVEMENTS.some((movement) => movement.orderId === order.id),
)!;

const orderWithoutMovements = SEED_ORDER_DETAILS.find(
  (order) => !SEED_STOCK_MOVEMENTS.some((movement) => movement.orderId === order.id),
)!;

async function refusal(call: Promise<unknown>): Promise<ApiError> {
  try {
    await call;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected the call to be refused, but it resolved");
}

/** Signs in for real, so the caller the store reads is a decoded token. */
async function signInAs(username: string, password: string = DEMO_PASSWORD): Promise<void> {
  const { accessToken } = await mockLogin(username, password);
  setAuthToken(accessToken);
}

beforeEach(() => {
  window.localStorage.clear();
  resetMockData();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("signing in", () => {
  it("issues a token carrying the signed-in user's identity and permissions", async () => {
    const { accessToken } = await mockLogin(onlyActiveAdmin.username, DEMO_PASSWORD);

    const session = readSession(accessToken);
    expect(session).not.toBeNull();
    expect(session).toMatchObject({
      userId: onlyActiveAdmin.id,
      companyId: onlyActiveAdmin.companyId,
      username: onlyActiveAdmin.username,
      role: onlyActiveAdmin.role,
    });
    expect(session!.permissions).toContain("USER_WRITE");
  });

  it("matches the username ignoring case and surrounding spaces", async () => {
    const { accessToken } = await mockLogin(
      `  ${onlyActiveAdmin.username.toUpperCase()}  `,
      DEMO_PASSWORD,
    );

    expect(readSession(accessToken)?.userId).toBe(onlyActiveAdmin.id);
  });

  it("refuses a wrong password without saying which half was wrong", async () => {
    const error = await refusal(mockLogin(onlyActiveAdmin.username, "not-the-password"));

    expect(error.status).toBe(422);
    expect(error.message).toBe("Invalid username or password");
  });

  it("refuses a deactivated account with the same message as an unknown one", async () => {
    const deactivated = await refusal(mockLogin(inactiveUser.username, DEMO_PASSWORD));
    const unknown = await refusal(mockLogin("nobody.here", DEMO_PASSWORD));

    expect(deactivated.message).toBe(unknown.message);
    expect(deactivated.status).toBe(422);
  });

  it("gives a session a permission set narrower than an administrator's", async () => {
    const { accessToken } = await mockLogin(activeNonAdmin.username, DEMO_PASSWORD);

    const session = readSession(accessToken);
    expect(session?.permissions).not.toContain("USER_WRITE");
  });
});

describe("products", () => {
  it("lists active products only, sorted by name", async () => {
    const listed = await mockListProducts();

    expect(listed.map((product) => product.id)).not.toContain(inactiveProduct.id);
    expect(listed.every((product) => product.active)).toBe(true);

    const names = listed.map((product) => product.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("adds a product and returns it in the list", async () => {
    const created = await mockCreateProduct({
      sku: "TENT-40X80",
      name: "40x80 Marquee",
      description: "Largest frame tent",
      rentalRate: 38000,
      securityDeposit: 15000,
    });

    expect(created).toMatchObject({
      sku: "TENT-40X80",
      active: true,
      rentalRate: { amount: 38000, currency: "INR" },
      securityDeposit: { amount: 15000, currency: "INR" },
    });
    await expect(mockListProducts()).resolves.toContainEqual(created);
  });

  it("refuses a SKU already used by this company, whatever its case", async () => {
    const error = await refusal(
      mockCreateProduct({
        sku: activeProduct.sku.toLowerCase(),
        name: "Duplicate",
        rentalRate: 100,
        securityDeposit: 0,
      }),
    );

    expect(error.status).toBe(422);
    expect(error.message).toBe(
      `A product with SKU ${activeProduct.sku.toLowerCase()} already exists for this company`,
    );
  });

  it("refuses a SKU already used by a product that was retired", async () => {
    // The check reads every product, not just the active ones, so a retired
    // SKU cannot be reused.
    const error = await refusal(
      mockCreateProduct({
        sku: inactiveProduct.sku,
        name: "Replacement tent",
        rentalRate: 9000,
        securityDeposit: 4000,
      }),
    );

    expect(error.status).toBe(422);
  });

  it("stores a blank description as absent and leaves the category unresolved", async () => {
    const created = await mockCreateProduct({
      sku: "MISC-001",
      name: "Unfiled item",
      description: "   ",
      rentalRate: 10,
      securityDeposit: 0,
    });

    expect(created.description).toBeNull();
    // No category endpoint exists, so a supplied id resolves to no name.
    expect(created.categoryName).toBeNull();
  });
});

describe("administering users", () => {
  it("lists deactivated users alongside active ones, and never their password", async () => {
    const listed = await mockListUsers();

    expect(listed.map((user) => user.id)).toContain(inactiveUser.id);
    expect(listed.every((user) => !("password" in user))).toBe(true);
  });

  it("adds a user as active and refuses a username already taken", async () => {
    const created = await mockCreateUser({
      username: "new.starter",
      email: "new.starter@tentvaale.example",
      password: "first-password",
      role: "SALES",
    });

    expect(created).toMatchObject({ username: "new.starter", role: "SALES", active: true });
    expect(created).not.toHaveProperty("password");

    const error = await refusal(
      mockCreateUser({
        username: "NEW.STARTER",
        email: "clash@tentvaale.example",
        password: "x",
        role: "SALES",
      }),
    );
    expect(error.status).toBe(422);
    expect(error.message).toBe(
      "A user named 'NEW.STARTER' already exists for this company",
    );
  });

  it("refuses to demote the only active administrator", async () => {
    await signInAs(activeNonAdmin.username);

    const error = await refusal(mockChangeUserRole(onlyActiveAdmin.id, "SALES"));

    expect(error.status).toBe(422);
    expect(error.message).toBe(
      "Cannot demote the only active ADMIN for this company; create another first",
    );
  });

  it("refuses to deactivate the only active administrator", async () => {
    await signInAs(activeNonAdmin.username);

    const error = await refusal(mockDeactivateUser(onlyActiveAdmin.id));

    expect(error.status).toBe(422);
    expect(error.message).toBe(
      "Cannot deactivate the only active ADMIN for this company; create another first",
    );
  });

  it("refuses to change your own role once another administrator exists", async () => {
    await signInAs(onlyActiveAdmin.username);
    // With a second administrator in place the last-admin rule no longer
    // applies, which is what leaves the self-demotion rule reachable.
    await mockCreateUser({
      username: "second.admin",
      email: "second.admin@tentvaale.example",
      password: "x",
      role: "ADMIN",
    });

    const error = await refusal(mockChangeUserRole(onlyActiveAdmin.id, "SALES"));

    expect(error.status).toBe(422);
    expect(error.message).toBe("You cannot change your own role; ask another administrator");
  });

  it("refuses to deactivate your own account", async () => {
    await signInAs(onlyActiveAdmin.username);

    const error = await refusal(mockDeactivateUser(onlyActiveAdmin.id));

    expect(error.status).toBe(422);
    expect(error.message).toBe("You cannot deactivate your own account");
  });

  it("promotes a user when an administrator asks", async () => {
    await signInAs(onlyActiveAdmin.username);

    const promoted = await mockChangeUserRole(activeNonAdmin.id, "ADMIN");

    expect(promoted.role).toBe("ADMIN");
  });

  it("deactivates another user, who can then no longer sign in", async () => {
    await signInAs(onlyActiveAdmin.username);

    const deactivated = await mockDeactivateUser(activeNonAdmin.id);
    expect(deactivated.active).toBe(false);

    const error = await refusal(mockLogin(activeNonAdmin.username, DEMO_PASSWORD));
    expect(error.message).toBe("Invalid username or password");
  });

  it("rejects the old password after a reset and accepts the new one", async () => {
    await mockResetUserPassword(activeNonAdmin.id, "brand-new-password");

    const error = await refusal(mockLogin(activeNonAdmin.username, DEMO_PASSWORD));
    expect(error.status).toBe(422);

    await expect(
      mockLogin(activeNonAdmin.username, "brand-new-password"),
    ).resolves.toHaveProperty("accessToken");
  });

  it("refuses to act on a user that does not exist", async () => {
    await signInAs(onlyActiveAdmin.username);

    const error = await refusal(mockDeactivateUser("no-such-user"));

    expect(error.status).toBe(404);
  });

  it("refuses a user administration call with no one signed in", async () => {
    expect(getAuthToken()).toBeNull();

    const error = await refusal(mockChangeUserRole(activeNonAdmin.id, "SALES"));

    expect(error.status).toBe(401);
  });
});

describe("deposits", () => {
  it("reads the deposit held against an order", async () => {
    const deposit = await mockGetDepositByOrder(heldDeposit.orderId);

    expect(deposit).toMatchObject({ orderId: heldDeposit.orderId, status: "HELD" });
  });

  it("reports an order with no deposit as not found", async () => {
    const error = await refusal(mockGetDepositByOrder("no-such-order"));

    expect(error.status).toBe(404);
    expect(error.message).toBe("No deposit held against order no-such-order");
  });

  it("moves a held deposit to refund pending and records the reason", async () => {
    const deposit = await mockRequestRefund(heldDeposit.orderId, "Event finished, all returned");

    expect(deposit.status).toBe("REFUND_PENDING");
    expect(deposit.reason).toBe("Event finished, all returned");
  });

  it("settles a pending refund and stamps the settlement time", async () => {
    const deposit = await mockConfirmRefunded(pendingDeposit.orderId, 24000);

    expect(deposit.status).toBe("REFUNDED");
    expect(deposit.amountRefunded).toEqual({ amount: 24000, currency: "INR" });
    expect(deposit.settledAt).toBeTruthy();
  });

  it("forfeits a held deposit with a reason", async () => {
    const deposit = await mockForfeit(secondHeldDeposit.orderId, 4000, "Chairs returned broken");

    expect(deposit.status).toBe("FORFEITED");
    expect(deposit.amountForfeited).toEqual({ amount: 4000, currency: "INR" });
    expect(deposit.reason).toBe("Chairs returned broken");
  });

  it("refuses to refund a deposit that was never marked pending", async () => {
    const error = await refusal(mockConfirmRefunded(heldDeposit.orderId, 15000));

    expect(error.status).toBe(422);
    expect(error.message).toBe(
      `Cannot move deposit for order ${heldDeposit.orderId} from HELD to REFUNDED`,
    );
  });

  it("refuses any further move once a deposit is settled", async () => {
    const error = await refusal(mockRequestRefund(settledDeposit.orderId));

    expect(error.status).toBe(422);
    expect(error.message).toBe(
      `Cannot move deposit for order ${settledDeposit.orderId} from REFUNDED to REFUND_PENDING`,
    );
  });

  it("accepts a refund larger than the amount held, because the backend does too", async () => {
    // recordRefund does not compare the amount against what is held. The settle
    // dialog warns; nothing refuses. README records this as a known gap.
    const held = Number(pendingDeposit.amountHeld.amount);

    const deposit = await mockConfirmRefunded(pendingDeposit.orderId, held * 10);

    expect(Number(deposit.amountRefunded.amount)).toBe(held * 10);
  });
});

describe("credit notes", () => {
  it("lists a customer's notes newest first", async () => {
    const listed = await mockListCreditNotesByCustomer(creditCustomer.id);

    expect(listed.length).toBeGreaterThan(1);
    expect(listed.every((note) => note.customerId === creditCustomer.id)).toBe(true);

    const dates = listed.map((note) => Date.parse(note.issuedOn));
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it("returns an empty list for a customer with no credit", async () => {
    await expect(mockListCreditNotesByCustomer("no-such-customer")).resolves.toEqual([]);
  });

  it("issues a note as unapplied credit and raises the customer's balance", async () => {
    const before = await mockGetCustomerCreditBalance(creditCustomer.id);

    const note = await mockIssueCreditNote({
      customerId: creditCustomer.id,
      amount: 2500,
      reason: "Goodwill",
    });

    expect(note).toMatchObject({
      status: "ISSUED",
      appliedAmount: { amount: 0, currency: "INR" },
      againstOrderId: null,
    });

    const after = await mockGetCustomerCreditBalance(creditCustomer.id);
    expect(Number(after.availableCredit.amount)).toBe(
      Number(before.availableCredit.amount) + 2500,
    );
  });

  it("refuses an amount of zero or less", async () => {
    const zero = await refusal(
      mockIssueCreditNote({ customerId: creditCustomer.id, amount: 0 }),
    );
    const negative = await refusal(
      mockIssueCreditNote({ customerId: creditCustomer.id, amount: -100 }),
    );

    expect(zero.status).toBe(422);
    expect(zero.message).toBe("A credit note amount must be positive");
    expect(negative.status).toBe(422);
  });

  it("reports no credit for a customer who has none", async () => {
    const balance = await mockGetCustomerCreditBalance("no-such-customer");

    expect(Number(balance.availableCredit.amount)).toBe(0);
  });
});

describe("notifications", () => {
  it("returns the newest attempts first", async () => {
    const listed = await mockListNotifications(200);

    const times = listed.map((row) => Date.parse(row.attemptedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("returns no more rows than the limit asks for", async () => {
    await expect(mockListNotifications(3)).resolves.toHaveLength(3);
  });

  it("clamps a limit below one rather than returning nothing", async () => {
    await expect(mockListNotifications(0)).resolves.toHaveLength(1);
  });

  it("clamps a limit above the service maximum rather than refusing it", async () => {
    const listed = await mockListNotifications(10_000);

    expect(listed).toHaveLength(SEED_NOTIFICATIONS.length);
    expect(listed.length).toBeLessThanOrEqual(200);
  });

  it("filters the log to one subject", async () => {
    const subject = SEED_NOTIFICATIONS[0].subjectReference;

    const listed = await mockListNotificationsBySubject(subject);

    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((row) => row.subjectReference === subject)).toBe(true);
  });

  it("returns an empty list for a subject nothing was sent about", async () => {
    await expect(mockListNotificationsBySubject("QT-0000-0000")).resolves.toEqual([]);
  });
});

describe("the dashboard", () => {
  it("counts a newly raised quotation as a draft", async () => {
    const before = await mockGetDashboard();

    await mockCreateQuotation({
      customerName: "Priya Desai",
      lines: [{ productId: activeProduct.id, quantity: 1, rentalDays: 1 }],
    });

    const after = await mockGetDashboard();
    expect(after.draftQuotations).toBe(before.draftQuotations + 1);
  });

  it("moves a quotation from draft to converted when an order is raised from it", async () => {
    const draft = SEED_QUOTATION_DETAILS.find(
      (quotation) =>
        quotation.status === "DRAFT" &&
        !SEED_ORDER_DETAILS.some((order) => order.quotationId === quotation.id),
    )!;
    const before = await mockGetDashboard();

    await mockCreateOrderFromQuotation(draft.id);

    const after = await mockGetDashboard();
    expect(after.draftQuotations).toBe(before.draftQuotations - 1);
    expect(after.convertedQuotations).toBe(before.convertedQuotations + 1);
    expect(after.totalOrders).toBe(before.totalOrders + 1);
    expect(Number(after.totalOrderValue.amount)).toBe(
      Number(before.totalOrderValue.amount) + Number(draft.totalAmount.amount),
    );
  });

  it("counts every seeded quotation, not just the few that can be opened", async () => {
    const dashboard = await mockGetDashboard();

    const counted =
      dashboard.draftQuotations +
      dashboard.sentQuotations +
      dashboard.acceptedQuotations +
      dashboard.convertedQuotations;

    // Rejected and expired are not returned by the endpoint, so the four
    // counts do not add up to the whole book — they must still exceed the
    // handful of full records the lookup screen can open.
    expect(counted).toBeGreaterThan(SEED_QUOTATION_DETAILS.length);
    expect(dashboard.totalOrders).toBe(SEED_ORDERS.length);
  });
});

describe("availability", () => {
  it("counts a dispatch as stock on rent", async () => {
    const before = await mockDeriveAvailability();
    const productId = orderWithMovements.lines[0].productId;
    const was = before.find((row) => row.productId === productId)!.onRent;

    await mockRecordStockMovement({
      orderId: orderWithMovements.id,
      direction: "OUTWARD",
      lines: [{ productId, quantity: 5 }],
    });

    const after = await mockDeriveAvailability();
    expect(after.find((row) => row.productId === productId)!.onRent).toBe(was + 5);
  });

  it("goes negative when more is returned than went out", async () => {
    // A known defect, recorded in README: the derivation is outward minus
    // inward with no floor, and the screen renders anything not above zero as
    // "In store". Pinned here so the contradiction is not lost.
    const productId = orderWithMovements.lines[0].productId;

    await mockRecordStockMovement({
      orderId: orderWithMovements.id,
      direction: "INWARD",
      lines: [{ productId, quantity: 10_000 }],
    });

    const after = await mockDeriveAvailability();
    expect(after.find((row) => row.productId === productId)!.onRent).toBeLessThan(0);
  });

  it("covers active products only, most on rent first", async () => {
    const rows = await mockDeriveAvailability();

    expect(rows.map((row) => row.productId)).not.toContain(inactiveProduct.id);

    const counts = rows.map((row) => row.onRent);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});

describe("looking a record up by id", () => {
  it("reports an unknown quotation as not found", async () => {
    const error = await refusal(mockGetQuotation("no-such-quotation"));

    expect(error.status).toBe(404);
  });

  it("reports an unknown order as not found", async () => {
    const error = await refusal(mockGetOrder("no-such-order"));

    expect(error.status).toBe(404);
  });

  it("reads a seeded order with its lines", async () => {
    const order = await mockGetOrder(orderWithMovements.id);

    expect(order.id).toBe(orderWithMovements.id);
    expect(order.lines.length).toBeGreaterThan(0);
  });

  it("lists an order's stock movements newest first", async () => {
    const listed = await mockListStockMovementsByOrder(orderWithMovements.id);

    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((movement) => movement.orderId === orderWithMovements.id)).toBe(true);

    const dates = listed.map((movement) => Date.parse(movement.movedOn));
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it("returns an empty list, not a refusal, for an order nothing has moved for", async () => {
    await expect(mockListStockMovementsByOrder(orderWithoutMovements.id)).resolves.toEqual([]);
  });
});
