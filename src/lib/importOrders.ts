import { prisma } from "./db";
import { getOrderSource } from "./dataSource";
import { RawOrderRow } from "./dataSource/types";

export interface ImportResult {
  status: "success" | "partial" | "failed";
  rowCount: number;
  orderCount: number;
  message?: string;
}

/**
 * Groups flat order-line rows by orderId, upserts the Order header once,
 * then replaces its OrderItem lines. Safe to re-run -- re-importing the
 * same source just overwrites each order's line items rather than
 * duplicating them.
 */
export async function importOrders(): Promise<ImportResult> {
  const source = getOrderSource();
  let rows: RawOrderRow[];

  try {
    rows = await source.fetchRows();
  } catch (err: any) {
    await prisma.importLog.create({
      data: {
        sourceType: source.sourceType,
        sourceRef: source.sourceRef,
        rowCount: 0,
        status: "failed",
        message: err.message,
      },
    });
    return { status: "failed", rowCount: 0, orderCount: 0, message: err.message };
  }

  const byOrder = new Map<string, RawOrderRow[]>();
  for (const row of rows) {
    const group = byOrder.get(row.orderId) ?? [];
    group.push(row);
    byOrder.set(row.orderId, group);
  }

  let orderCount = 0;
  for (const [externalId, items] of byOrder) {
    const first = items[0];
    const order = await prisma.order.upsert({
      where: { externalId },
      create: {
        externalId,
        orderDate: new Date(first.orderDate),
        status: first.status,
        channel: first.channel,
      },
      update: {
        orderDate: new Date(first.orderDate),
        status: first.status,
        channel: first.channel,
      },
    });

    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.orderItem.createMany({
      data: items.map((i) => ({
        orderId: order.id,
        productName: i.productName,
        sku: i.sku,
        category: i.category,
        quantity: i.quantity,
        weightG: i.weightG,
        itemCost: i.itemCost,
      })),
    });
    orderCount++;
  }

  await prisma.importLog.create({
    data: {
      sourceType: source.sourceType,
      sourceRef: source.sourceRef,
      rowCount: rows.length,
      status: "success",
    },
  });

  return { status: "success", rowCount: rows.length, orderCount };
}
