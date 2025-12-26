export type Product = {
  id: string;
  name: string;
  salePrice: number;   // ¥
  unitCost: number;    // ¥ custo matéria-prima por unidade
  photos: string[];
  active: boolean;
  createdAt?: any;
};

export type CartItem = {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
  photo?: string;
};

export type OrderStatus = "pending" | "in_progress" | "done" | "cancelled";

export type Order = {
  id: string;
  status: OrderStatus;
  customer: {
    mode: "quick";
    name: string;
    nameLower: string;
    phone: string;
    phoneNorm: string;
    pinHash: string;
    customerUid?: string; // uid gerado via custom token (quick_xxx)
  };
  items: Array<{
    productId: string;
    nameSnapshot: string;
    qty: number;
    unitPriceSnapshot: number;
    unitCostSnapshot: number;
  }>;
  totals: {
    revenue: number;
    cost: number;
    profit: number;
  };
  createdAt?: any;
};
