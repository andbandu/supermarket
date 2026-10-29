import { Product, Order, HeldOrder, CashierShift, POSSettings, PaymentMethod } from '@/types/pos';

const DEFAULT_API_KEY = 'minimart_pos_sec_key_2026';

class MinimartApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey = DEFAULT_API_KEY, baseUrl = '/api') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
    };
  }

  // Health check
  async checkHealth(): Promise<{
    status: string;
    version?: string;
    service?: string;
    orm?: string;
    database: {
      type: string;
      prismaConfigured?: boolean;
      supabaseConfigured?: boolean;
      status: string;
      productsCount?: number;
    } | string;
    message?: string;
  }> {
    const res = await fetch(`${this.baseUrl}/health`, {
      headers: this.getHeaders(),
    });
    return res.json();
  }

  // Sync offline/local orders to Supabase PostgreSQL
  async syncToDatabase(): Promise<{ success: boolean; message?: string; error?: string; data?: unknown }> {
    const res = await fetch(`${this.baseUrl}/sync-to-supabase`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return res.json();
  }

  // Products
  async getProducts(): Promise<{ success: boolean; data: Product[]; source: string }> {
    const res = await fetch(`${this.baseUrl}/products`, {
      headers: this.getHeaders(),
    });
    return res.json();
  }

  async createProduct(product: Omit<Product, 'id'>): Promise<{ success: boolean; data: Product }> {
    const res = await fetch(`${this.baseUrl}/products`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(product),
    });
    return res.json();
  }

  async updateProduct(id: string, product: Partial<Product>): Promise<{ success: boolean; data: Product }> {
    const res = await fetch(`${this.baseUrl}/products/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(product),
    });
    return res.json();
  }

  async restockProduct(id: string, amount: number): Promise<{ success: boolean; data: Product }> {
    const res = await fetch(`${this.baseUrl}/products/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ restockAmount: amount }),
    });
    return res.json();
  }

  async deleteProduct(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/products/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return res.json();
  }

  // Orders
  async getOrders(): Promise<{ success: boolean; data: Order[]; source: string }> {
    const res = await fetch(`${this.baseUrl}/orders`, {
      headers: this.getHeaders(),
    });
    return res.json();
  }

  async createOrder(orderPayload: {
    id?: string;
    receiptNumber?: string;
    timestamp?: string;
    items: Array<{
      productId: string;
      productName: string;
      barcode: string;
      quantity: number;
      unitPrice: number;
      discountPercent: number;
      totalPrice: number;
    }>;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    total: number;
    paymentMethod: PaymentMethod;
    amountTendered: number;
    changeGiven: number;
    cashierName: string;
    notes?: string;
  }): Promise<{ success: boolean; data: Order; error?: string }> {
    const res = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(orderPayload),
    });
    return res.json();
  }

  async refundOrder(
    orderIdOrReceiptNumber: string,
    reason: string
  ): Promise<{ success: boolean; message?: string; data?: Order; error?: string }> {
    const res = await fetch(
      `${this.baseUrl}/orders/${encodeURIComponent(orderIdOrReceiptNumber)}/refund`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ reason }),
      }
    );
    return res.json();
  }

  // Held Orders
  async getHeldOrders(): Promise<{ success: boolean; data: HeldOrder[] }> {
    const res = await fetch(`${this.baseUrl}/held-orders`, {
      headers: this.getHeaders(),
    });
    return res.json();
  }

  async saveHeldOrder(heldOrder: HeldOrder): Promise<{ success: boolean; data: HeldOrder }> {
    const res = await fetch(`${this.baseUrl}/held-orders`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(heldOrder),
    });
    return res.json();
  }

  async deleteHeldOrder(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/held-orders/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return res.json();
  }

  // Shift & Z-Report
  async getShift(): Promise<{ success: boolean; data: CashierShift }> {
    const res = await fetch(`${this.baseUrl}/shifts`, {
      headers: this.getHeaders(),
    });
    return res.json();
  }

  async saveShift(shift: CashierShift): Promise<{ success: boolean; data: CashierShift }> {
    const res = await fetch(`${this.baseUrl}/shifts`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(shift),
    });
    return res.json();
  }

  // Settings
  async getSettings(): Promise<{ success: boolean; data: POSSettings }> {
    const res = await fetch(`${this.baseUrl}/settings`, {
      headers: this.getHeaders(),
    });
    return res.json();
  }

  async updateSettings(settings: Partial<POSSettings>): Promise<{ success: boolean; data: POSSettings }> {
    const res = await fetch(`${this.baseUrl}/settings`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(settings),
    });
    return res.json();
  }
}

export const apiClient = new MinimartApiClient();
