-- Monetary fields use integer grosz; percentage coupon value uses basis points.
-- Historical PAID orders came from the same simulated checkout.
PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

CREATE TABLE "new_Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoryId" INTEGER NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Product" SELECT "id", "name", "slug", "description", CAST(ROUND("price" * 100) AS INTEGER), "imageUrl", "stock", "featured", "createdAt", "categoryId" FROM "Product";

DROP TABLE "Product";

ALTER TABLE "new_Product" RENAME TO "Product";

CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

CREATE TABLE "new_Coupon" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "minTotal" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_Coupon" SELECT "id", "code", "type", CAST(ROUND("value" * 100) AS INTEGER), CAST(ROUND("minTotal" * 100) AS INTEGER), "active", "createdAt" FROM "Coupon";

DROP TABLE "Coupon";

ALTER TABLE "new_Coupon" RENAME TO "Coupon";

CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

CREATE TABLE "new_Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DEMO_SIMULATED',
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "couponCode" TEXT,
    "shippingName" TEXT NOT NULL,
    "shippingEmail" TEXT NOT NULL,
    "shippingAddress" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Order" SELECT "id", "userId", CASE WHEN "status" = 'PAID' THEN 'DEMO_SIMULATED' ELSE "status" END, CAST(ROUND("subtotal" * 100) AS INTEGER), CAST(ROUND("discount" * 100) AS INTEGER), CAST(ROUND("total" * 100) AS INTEGER), "couponCode", "shippingName", "shippingEmail", "shippingAddress", "createdAt" FROM "Order";

DROP TABLE "Order";

ALTER TABLE "new_Order" RENAME TO "Order";

CREATE TABLE "new_OrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_OrderItem" SELECT "id", "orderId", "productId", "productName", CAST(ROUND("unitPrice" * 100) AS INTEGER), "quantity", CAST(ROUND("total" * 100) AS INTEGER) FROM "OrderItem";

DROP TABLE "OrderItem";

ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";

COMMIT;

PRAGMA foreign_keys=ON;
