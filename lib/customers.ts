import { hashSecret, constantTimeEqual } from "@/lib/crypto";

export interface Customer {
  id: string;
  /** SHA-256 hex of the raw API secret. Optional — omit to allow open access. */
  secretHash?: string;
  features: string[];
  name?: string;
}

/** Dev fallback — used when CUSTOMER_REGISTRY env var is absent. */
const DEV_CUSTOMERS: Customer[] = [
  {
    id: "customerA",
    // No secretHash — open access in dev
    features: ["analytics", "export", "dashboard"],
    name: "Customer A (dev)",
  },
  {
    id: "customerB",
    // Secret "dev-secret-b" hashed — requires apiSecret in dev
    secretHash: "a8b3f4c3ace9977569ceda64ff3dad055dc762a74fae0df05d87c115f3beec02", // SHA-256 of "dev-secret-b"
    features: ["export"],
    name: "Customer B (dev)",
  },
];

let _customers: Customer[] | null = null;

export function loadCustomers(): Customer[] {
  if (_customers) return _customers;

  const raw = process.env.CUSTOMER_REGISTRY;
  if (!raw) {
    _customers = DEV_CUSTOMERS;
    return _customers;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new Error("CUSTOMER_REGISTRY must be a JSON array");
    _customers = parsed as Customer[];
    return _customers;
  } catch (err) {
    throw new Error(`Failed to parse CUSTOMER_REGISTRY: ${err}`);
  }
}

export function findCustomer(id: string): Customer | undefined {
  return loadCustomers().find((c) => c.id === id);
}

/**
 * Authenticate a customer request.
 * - If the customer has no secretHash → access is open (return true).
 * - If the customer has a secretHash → apiSecret must match.
 */
export function authenticateCustomer(customer: Customer, apiSecret?: string): boolean {
  if (!customer.secretHash) return true;
  if (!apiSecret) return false;
  return constantTimeEqual(hashSecret(apiSecret), customer.secretHash);
}
