import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/services/api-client";
import type { Money } from "@/lib/money";
import * as store from "@/mock-data/store";
import {
  mockCreateBundle,
  mockCreateCategory,
  mockCreateCustomer,
  mockCreateOrderFromQuotation,
  mockCreateQuotation,
  mockCreateTruck,
  mockCreateWarehouse,
  mockDeactivateCategory,
  mockDeleteBundle,
  mockDeleteTruck,
  mockDeleteWarehouse,
  mockGetQuotation,
  mockListBundles,
  mockListCategories,
  mockListCustomers,
  mockListTrucks,
  mockListWarehouses,
  mockRecordStockMovement,
  mockUpdateBundle,
  mockUpdateCategory,
  mockUpdateCustomer,
  mockUpdateTruck,
  mockUpdateWarehouse,
  resetMockData,
} from "@/mock-data/store";
import {
  SEED_BUNDLES,
  SEED_CATEGORIES,
  SEED_CUSTOMERS,
  SEED_ORDER_DETAILS,
  SEED_PRODUCTS,
  SEED_QUOTATION_DETAILS,
  SEED_STOCK_MOVEMENTS,
  SEED_TRUCKS,
  SEED_WAREHOUSES,
} from "@/mock-data/seed";

/**
 * Covers the create/edit/delete paths added in "Complete the sales workflow and
 * master-data editing".
 *
 * Two things are worth stating about what these assertions mean. The
 * master-data rules below are the mock's own proposals — no controller serves
 * these paths — so each test pins what this application currently promises, not
 * what the backend guarantees. The quotation, conversion and stock-movement
 * rules do mirror real endpoints, and are asserted as such.
 *
 * No test needs a signed-in caller: only the user role-change and deactivation
 * paths read the token, and those are not part of this change.
 */

/** The seed warehouse nothing has moved stock through, so it can be deleted. */
const unusedWarehouse = SEED_WAREHOUSES.find(
  (warehouse) =>
    !SEED_STOCK_MOVEMENTS.some((movement) => movement.warehouseId === warehouse.id),
)!;

/** Two movements refer to this one, which is what makes the plural readable. */
const warehouseWithTwoMovements = SEED_WAREHOUSES.find(
  (warehouse) =>
    SEED_STOCK_MOVEMENTS.filter((movement) => movement.warehouseId === warehouse.id)
      .length === 2,
)!;

/** Exactly one refers to this one — the singular branch of the same message. */
const warehouseWithOneMovement = SEED_WAREHOUSES.find(
  (warehouse) =>
    SEED_STOCK_MOVEMENTS.filter((movement) => movement.warehouseId === warehouse.id)
      .length === 1,
)!;

/** The only seeded quotation no order was raised from. */
const convertibleQuotation = SEED_QUOTATION_DETAILS.find(
  (quotation) =>
    !SEED_ORDER_DETAILS.some((order) => order.quotationId === quotation.id),
)!;

/** A quotation that already has an order, so converting it is refused. */
const alreadyOrderedQuotation = SEED_QUOTATION_DETAILS.find((quotation) =>
  SEED_ORDER_DETAILS.some((order) => order.quotationId === quotation.id),
)!;

const frameTent = SEED_PRODUCTS.find((product) => product.sku === "TENT-20X40")!;
const goldChair = SEED_PRODUCTS.find((product) => product.sku === "CHR-GOLD")!;

/**
 * Asserts a call was refused and hands back the error, so a test can check the
 * status and the wording rather than only that something threw.
 */
/**
 * Money.amount is `number | string` because it is a Java BigDecimal on the
 * wire, and the store itself prices through Number(). The arithmetic below does
 * the same rather than assuming the narrower type.
 */
const amountOf = (money: Money): number => Number(money.amount);

async function refusal(call: Promise<unknown>): Promise<ApiError> {
  try {
    await call;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected the call to be refused, but it resolved");
}

beforeEach(() => {
  window.localStorage.clear();
  resetMockData();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("categories", () => {
  it("adds a category and returns it in the list", async () => {
    const created = await mockCreateCategory({ name: "Draping" });

    expect(created.active).toBe(true);
    await expect(mockListCategories()).resolves.toContainEqual(created);
  });

  it("refuses a category whose name only differs by case", async () => {
    const existing = SEED_CATEGORIES[0];

    const error = await refusal(mockCreateCategory({ name: existing.name.toLowerCase() }));

    expect(error.status).toBe(422);
    expect(error.message).toBe(
      `A category named '${existing.name.toLowerCase()}' already exists for this company`,
    );
  });

  it("refuses a rename onto another category's name", async () => {
    const [first, second] = SEED_CATEGORIES;

    const error = await refusal(mockUpdateCategory(first.id, { name: second.name }));

    expect(error.status).toBe(422);
    expect(error.message).toBe(
      `A category named '${second.name}' already exists for this company`,
    );
  });

  it("allows a category to be saved under its own unchanged name", async () => {
    const existing = SEED_CATEGORIES[0];

    await expect(
      mockUpdateCategory(existing.id, { name: existing.name }),
    ).resolves.toMatchObject({ id: existing.id, name: existing.name });
  });

  it("deactivates a category rather than deleting it, and refuses a second attempt", async () => {
    const existing = SEED_CATEGORIES[0];

    const deactivated = await mockDeactivateCategory(existing.id);
    expect(deactivated.active).toBe(false);

    const listed = await mockListCategories();
    expect(listed.map((category) => category.id)).not.toContain(existing.id);

    const error = await refusal(mockDeactivateCategory(existing.id));
    expect(error.status).toBe(422);
    expect(error.message).toBe(`Category '${existing.name}' is already inactive`);
  });

  it("reports an unknown category as not found rather than as a refusal", async () => {
    const error = await refusal(mockUpdateCategory("no-such-category", { name: "Draping" }));

    expect(error.status).toBe(404);
  });

  it("still refuses a name held by a deactivated category the list no longer shows", async () => {
    const existing = SEED_CATEGORIES[0];
    await mockDeactivateCategory(existing.id);

    const listed = await mockListCategories();
    expect(listed.map((category) => category.name)).not.toContain(existing.name);

    // The duplicate check reads every category; the list reads only the active
    // ones. So the name stays taken by a row the user can no longer see.
    const error = await refusal(mockCreateCategory({ name: existing.name }));
    expect(error.status).toBe(422);
    expect(error.message).toBe(
      `A category named '${existing.name}' already exists for this company`,
    );
  });

  it("offers no way to reactivate a category once it is deactivated", () => {
    // Paired with the test above: together they make the name unusable for good.
    const names = Object.keys(store);
    expect(names).not.toContain("mockActivateCategory");
    expect(names).not.toContain("mockReactivateCategory");
  });
});

describe("warehouses", () => {
  it("adds a warehouse and returns it in the list", async () => {
    const created = await mockCreateWarehouse({ name: "Thane Yard", city: "Thane" });

    const listed = await mockListWarehouses();
    expect(listed).toContainEqual(created);
  });

  it("refuses a warehouse whose name only differs by case or padding", async () => {
    const existing = SEED_WAREHOUSES[0];

    const error = await refusal(
      mockCreateWarehouse({ name: `  ${existing.name.toUpperCase()}  `, city: "Mumbai" }),
    );

    expect(error.status).toBe(422);
  });

  it("refuses a rename onto another warehouse's name", async () => {
    const [first, second] = SEED_WAREHOUSES;

    const error = await refusal(
      mockUpdateWarehouse(first.id, { name: second.name, city: first.city }),
    );

    expect(error.status).toBe(422);
    expect(error.message).toBe(
      `A warehouse named '${second.name}' already exists for this company`,
    );
  });

  it("saves a changed name and city", async () => {
    const existing = SEED_WAREHOUSES[0];

    const updated = await mockUpdateWarehouse(existing.id, {
      name: "Andheri Central Store",
      city: "Navi Mumbai",
    });

    expect(updated).toMatchObject({
      id: existing.id,
      name: "Andheri Central Store",
      city: "Navi Mumbai",
    });
    await expect(mockListWarehouses()).resolves.toContainEqual(updated);
  });

  it("deletes a warehouse nothing has moved stock through", async () => {
    await mockDeleteWarehouse(unusedWarehouse.id);

    const listed = await mockListWarehouses();
    expect(listed.map((warehouse) => warehouse.id)).not.toContain(unusedWarehouse.id);
  });

  it("refuses to delete a warehouse while stock movements still refer to it", async () => {
    const error = await refusal(mockDeleteWarehouse(warehouseWithTwoMovements.id));

    expect(error.status).toBe(422);
    expect(error.message).toBe(
      `'${warehouseWithTwoMovements.name}' cannot be deleted: 2 stock movements refer to it`,
    );

    const listed = await mockListWarehouses();
    expect(listed.map((warehouse) => warehouse.id)).toContain(warehouseWithTwoMovements.id);
  });

  it("words the refusal in the singular when exactly one movement refers to it", async () => {
    const error = await refusal(mockDeleteWarehouse(warehouseWithOneMovement.id));

    expect(error.message).toBe(
      `'${warehouseWithOneMovement.name}' cannot be deleted: 1 stock movement refers to it`,
    );
  });
});

describe("trucks", () => {
  it("adds a truck and returns it in the list", async () => {
    const created = await mockCreateTruck({ registration: "MH 14 GH 2255", capacityKg: 5000 });

    expect(created).toMatchObject({ registration: "MH 14 GH 2255", capacityKg: 5000 });
    await expect(mockListTrucks()).resolves.toContainEqual(created);
  });

  it("refuses a registration already on the fleet", async () => {
    const existing = SEED_TRUCKS[0];

    const error = await refusal(
      mockCreateTruck({ registration: existing.registration.toLowerCase(), capacityKg: 2000 }),
    );

    expect(error.status).toBe(422);
    expect(error.message).toBe(
      `Truck ${existing.registration.toLowerCase()} is already on the fleet`,
    );
  });

  it("keeps a truck's own registration when only its capacity changes", async () => {
    const existing = SEED_TRUCKS[0];

    const updated = await mockUpdateTruck(existing.id, {
      registration: existing.registration,
      capacityKg: 4200,
    });

    expect(updated).toMatchObject({
      id: existing.id,
      registration: existing.registration,
      capacityKg: 4200,
    });
  });

  it("deletes a truck outright, because nothing references one", async () => {
    const existing = SEED_TRUCKS[0];

    await mockDeleteTruck(existing.id);

    const listed = await mockListTrucks();
    expect(listed.map((truck) => truck.id)).not.toContain(existing.id);
  });
});

describe("bundles", () => {
  it("adds a bundle with its contents and rate", async () => {
    const created = await mockCreateBundle({
      name: "Sangeet Night Kit",
      contents: ["10x10 Canopy", "Fairy Light Curtain"],
      rentalRate: 7400,
    });

    expect(created).toMatchObject({
      name: "Sangeet Night Kit",
      contents: ["10x10 Canopy", "Fairy Light Curtain"],
      rentalRate: { amount: 7400, currency: "INR" },
    });
    await expect(mockListBundles()).resolves.toContainEqual(created);
  });

  it("saves changed contents and a changed rate", async () => {
    const existing = SEED_BUNDLES[0];

    const updated = await mockUpdateBundle(existing.id, {
      name: existing.name,
      contents: ["10x10 Canopy"],
      rentalRate: 9900,
    });

    expect(updated).toMatchObject({
      id: existing.id,
      contents: ["10x10 Canopy"],
      rentalRate: { amount: 9900, currency: "INR" },
    });
  });

  it("refuses a bundle with no contents", async () => {
    const error = await refusal(
      mockCreateBundle({ name: "Empty Kit", contents: [], rentalRate: 5000 }),
    );

    expect(error.status).toBe(422);
    expect(error.message).toBe("A bundle must contain at least one product");
  });

  it("refuses an edit that empties an existing bundle", async () => {
    const existing = SEED_BUNDLES[0];

    const error = await refusal(
      mockUpdateBundle(existing.id, {
        name: existing.name,
        contents: [],
        rentalRate: 1000,
      }),
    );

    expect(error.message).toBe("A bundle must contain at least one product");
  });

  it("refuses a bundle name already in use", async () => {
    const existing = SEED_BUNDLES[0];

    const error = await refusal(
      mockCreateBundle({ name: existing.name, contents: ["10x10 Canopy"], rentalRate: 500 }),
    );

    expect(error.status).toBe(422);
    expect(error.message).toBe(
      `A bundle named '${existing.name}' already exists for this company`,
    );
  });

  it("deletes a bundle outright, because no quotation line references one", async () => {
    const existing = SEED_BUNDLES[0];

    await mockDeleteBundle(existing.id);

    const listed = await mockListBundles();
    expect(listed.map((bundle) => bundle.id)).not.toContain(existing.id);
  });
});

describe("customers", () => {
  it("refuses a second account for an email already registered", async () => {
    const existing = SEED_CUSTOMERS[0];

    const error = await refusal(
      mockCreateCustomer({
        email: existing.email.toUpperCase(),
        fullName: "Someone Else",
        accountType: "CUSTOMER",
      }),
    );

    expect(error.status).toBe(422);
    expect(error.message).toBe(`An account already exists for ${existing.email.toUpperCase()}`);
  });

  it("stores a blank phone number as absent rather than as an empty string", async () => {
    const created = await mockCreateCustomer({
      email: "new.customer@example.com",
      fullName: "New Customer",
      phone: "   ",
      accountType: "CUSTOMER",
    });

    expect(created.phone).toBeNull();
  });

  it("keeps a customer's own email when only their name changes", async () => {
    const existing = SEED_CUSTOMERS[0];

    const updated = await mockUpdateCustomer(existing.id, {
      email: existing.email,
      fullName: "Amit S. Shah",
      accountType: existing.accountType,
    });

    expect(updated).toMatchObject({ id: existing.id, fullName: "Amit S. Shah" });
    await expect(mockListCustomers()).resolves.toContainEqual(updated);
  });

  it("offers no way to delete a customer", () => {
    // Deliberate: a customer's account is what quotations and orders were
    // raised against, so the store proposes edit-only. README records this.
    expect(Object.keys(store)).not.toContain("mockDeleteCustomer");
  });
});

describe("raising a quotation", () => {
  it("prices a line by rate x quantity x days, and the deposit per unit only", async () => {
    const created = await mockCreateQuotation({
      customerName: "Priya Desai",
      lines: [
        { productId: frameTent.id, quantity: 2, rentalDays: 3 },
        { productId: goldChair.id, quantity: 80, rentalDays: 3 },
      ],
    });

    const tentLine = created.lines[0];
    const chairLine = created.lines[1];

    expect(amountOf(tentLine.lineTotal)).toBe(amountOf(frameTent.rentalRate) * 2 * 3);
    expect(amountOf(chairLine.lineTotal)).toBe(amountOf(goldChair.rentalRate) * 80 * 3);

    expect(amountOf(created.totalAmount)).toBe(
      amountOf(tentLine.lineTotal) + amountOf(chairLine.lineTotal),
    );

    // The deposit is held against the goods, not rented, so it is NOT
    // multiplied by rental days — the one place the two formulas differ.
    expect(amountOf(created.totalSecurityDeposit)).toBe(
      amountOf(frameTent.securityDeposit) * 2 + amountOf(goldChair.securityDeposit) * 80,
    );
  });

  it("stamps a new quotation as a draft raised in the back office", async () => {
    const created = await mockCreateQuotation({
      customerName: "Priya Desai",
      lines: [{ productId: frameTent.id, quantity: 1, rentalDays: 1 }],
    });

    expect(created.status).toBe("DRAFT");
    expect(created.sourceReference).toBe("admin-ui");
    expect(created.customerId).toBeNull();
    await expect(mockGetQuotation(created.id)).resolves.toMatchObject({ id: created.id });
  });

  it("refuses a quotation with no lines", async () => {
    const error = await refusal(
      mockCreateQuotation({ customerName: "Priya Desai", lines: [] }),
    );

    expect(error.status).toBe(422);
    expect(error.message).toBe("A quotation must have at least one line");
  });

  it("refuses a line with a quantity below one", async () => {
    const error = await refusal(
      mockCreateQuotation({
        customerName: "Priya Desai",
        lines: [{ productId: frameTent.id, quantity: 0, rentalDays: 2 }],
      }),
    );

    expect(error.status).toBe(422);
    expect(error.message).toBe("Quantity and rental days must both be at least 1");
  });

  it("refuses a line naming a product that does not exist", async () => {
    const error = await refusal(
      mockCreateQuotation({
        customerName: "Priya Desai",
        lines: [{ productId: "no-such-product", quantity: 1, rentalDays: 1 }],
      }),
    );

    expect(error.status).toBe(404);
  });
});

describe("converting a quotation to an order", () => {
  it("copies the quotation onto a confirmed order and marks the quotation converted", async () => {
    const order = await mockCreateOrderFromQuotation(convertibleQuotation.id);

    expect(order.status).toBe("CONFIRMED");
    expect(order.quotationId).toBe(convertibleQuotation.id);
    expect(order.customerName).toBe(convertibleQuotation.customerName);
    expect(order.totalAmount).toEqual(convertibleQuotation.totalAmount);
    expect(order.securityDeposit).toEqual(convertibleQuotation.totalSecurityDeposit);
    expect(order.lines).toHaveLength(convertibleQuotation.lines.length);
    expect(order.lines[0]).toMatchObject({
      productId: convertibleQuotation.lines[0].productId,
      quantity: convertibleQuotation.lines[0].quantity,
      lineTotal: convertibleQuotation.lines[0].lineTotal,
    });

    await expect(mockGetQuotation(convertibleQuotation.id)).resolves.toMatchObject({
      status: "CONVERTED",
    });
  });

  it("refuses to convert the same quotation twice", async () => {
    await mockCreateOrderFromQuotation(convertibleQuotation.id);

    const error = await refusal(mockCreateOrderFromQuotation(convertibleQuotation.id));

    expect(error.status).toBe(422);
    expect(error.message).toBe(
      `An order already exists for quotation ${convertibleQuotation.quotationNumber}`,
    );
  });

  it("refuses a quotation an order was already raised from", async () => {
    const error = await refusal(mockCreateOrderFromQuotation(alreadyOrderedQuotation.id));

    expect(error.status).toBe(422);
    expect(error.message).toBe(
      `An order already exists for quotation ${alreadyOrderedQuotation.quotationNumber}`,
    );
  });
});

describe("recording a stock movement", () => {
  const order = SEED_ORDER_DETAILS[0];

  it("records a movement against an existing order", async () => {
    const movement = await mockRecordStockMovement({
      orderId: order.id,
      direction: "OUTWARD",
      movedOn: "2026-04-01",
      warehouseId: SEED_WAREHOUSES[0].id,
      lines: [{ productId: order.lines[0].productId, quantity: 2 }],
    });

    expect(movement).toMatchObject({
      orderId: order.id,
      direction: "OUTWARD",
      movedOn: "2026-04-01",
      warehouseId: SEED_WAREHOUSES[0].id,
    });
    expect(movement.lines).toEqual([
      { id: `${movement.id}-L1`, productId: order.lines[0].productId, quantity: 2 },
    ]);
  });

  it("dates a movement today when no date is given", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-04-09T08:30:00.000Z"));

    const movement = await mockRecordStockMovement({
      orderId: order.id,
      direction: "OUTWARD",
      lines: [{ productId: order.lines[0].productId, quantity: 1 }],
    });

    expect(movement.movedOn).toBe("2026-04-09");
  });

  it("refuses a movement with no lines", async () => {
    const error = await refusal(
      mockRecordStockMovement({ orderId: order.id, direction: "OUTWARD", lines: [] }),
    );

    expect(error.status).toBe(422);
    expect(error.message).toBe("A stock movement must have at least one line");
  });

  it("refuses a movement against an order that does not exist", async () => {
    const error = await refusal(
      mockRecordStockMovement({
        orderId: "no-such-order",
        direction: "OUTWARD",
        lines: [{ productId: frameTent.id, quantity: 1 }],
      }),
    );

    expect(error.status).toBe(404);
  });

  it("refuses a line with a quantity below one", async () => {
    const error = await refusal(
      mockRecordStockMovement({
        orderId: order.id,
        direction: "OUTWARD",
        lines: [{ productId: order.lines[0].productId, quantity: 0 }],
      }),
    );

    expect(error.status).toBe(422);
    expect(error.message).toBe("Movement quantity must be at least 1");
  });

  it("accepts a product the order never contained, because the backend does too", async () => {
    // Not an oversight in the test: InventoryService checks only that the order
    // exists and the quantities are positive. The legacy validation lives in
    // stored procedures nobody has read, and README records the gap. If this
    // ever starts failing, the guard was added and the README needs updating.
    const absentProduct = SEED_PRODUCTS.find(
      (product) => !order.lines.some((line) => line.productId === product.id),
    )!;

    const movement = await mockRecordStockMovement({
      orderId: order.id,
      direction: "OUTWARD",
      lines: [{ productId: absentProduct.id, quantity: 999 }],
    });

    expect(movement.lines[0]).toMatchObject({ productId: absentProduct.id, quantity: 999 });
  });
});

describe("persistence", () => {
  it("writes an edit to local storage so it survives a reload", async () => {
    const created = await mockCreateCategory({ name: "Draping" });

    // The storage key is not exported; this is the one place the test knows it.
    const stored = window.localStorage.getItem("tentvaale.admin.mock.v2");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).categories).toContainEqual(created);
  });
});
