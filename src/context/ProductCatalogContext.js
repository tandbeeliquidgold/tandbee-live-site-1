import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ProductCatalogContext = createContext({
  overrides: {},
  loading: true,
  error: null,
});

const FALLBACK_HONEY_FLAVORS = [
  "Chocolate Creamed Honey",
  "Cinnamon Creamed Honey",
  "Pumpkin Creamed Honey",
  "Sea Salt Creamed Honey",
  "Vanilla Creamed Honey",
  "Bourbon Creamed Honey",
  "Blueberry Creamed Honey",
  "Strawberry Creamed Honey",
  "Hot n' Spicy Honey",
];

export function ProductCatalogProvider({ children }) {
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/products")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Product catalog request failed (${response.status})`);
        }
        return response.json();
      })
      .then(({ products = [] }) => {
        if (cancelled) return;

        const byId = products.reduce((catalog, product) => {
          catalog[product.productId] = product;
          return catalog;
        }, {});

        setOverrides(byId);
        setError(null);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ overrides, loading, error }),
    [overrides, loading, error]
  );

  return (
    <ProductCatalogContext.Provider value={value}>
      {children}
    </ProductCatalogContext.Provider>
  );
}

export function useProductCatalog() {
  return useContext(ProductCatalogContext);
}

export function getAvailableHoneyFlavors(overrides, shopRegion) {
  const honeyProducts = Object.values(overrides).filter(
    (product) => product.section === "Honey Collection" && product.itemName
  );

  if (!honeyProducts.length) {
    return FALLBACK_HONEY_FLAVORS;
  }

  const stockField = shopRegion === "US" ? "stockUS" : "stockIL";
  return honeyProducts
    .filter((product) => product[stockField] !== false)
    .map((product) => product.itemName);
}

export function applyCatalogOverride(
  item,
  productId,
  overrides,
  shopRegion
) {
  const resolvedProductId = productId || item.productId || item.id;
  const override = overrides[resolvedProductId];

  if (!override) {
    return { ...item, productId: resolvedProductId };
  }

  const inStock = shopRegion === "US" ? override.stockUS : override.stockIL;

  return {
    ...item,
    productId: resolvedProductId,
    ...((override.priceUS !== null || override.priceIL !== null) ? {
      priceDollar: override.priceUS ?? item.priceDollar,
      priceShekel: override.priceIL ?? item.priceShekel,
    } : {}),
    ...(typeof inStock === "boolean" ? { isSoldOut: !inStock } : {}),
  };
}

export function applyCatalogOverrides(items, overrides, shopRegion) {
  return items.map((item) =>
    applyCatalogOverride(
      item,
      item.productId || item.id,
      overrides,
      shopRegion
    )
  );
}
