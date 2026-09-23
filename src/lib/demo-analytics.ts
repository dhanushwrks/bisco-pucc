/** Showcase analytics — replace with real aggregates when revenue/category tracking ships. */

export type MonthPoint = { month: string; revenue: number; tests: number };

export type CategoryCount = {
  key: string;
  label: string;
  count: number;
  /** Share of fee mix for the demo legend */
  avgFee: number;
};

/** Last 6 calendar months of demo revenue (INR) for a mid-size multi-outlet centre. */
export const DEMO_REVENUE: MonthPoint[] = [
  { month: "Apr", revenue: 1_84_500, tests: 1_120 },
  { month: "May", revenue: 2_12_800, tests: 1_280 },
  { month: "Jun", revenue: 1_96_200, tests: 1_190 },
  { month: "Jul", revenue: 2_41_600, tests: 1_450 },
  { month: "Aug", revenue: 2_28_400, tests: 1_370 },
  { month: "Sep", revenue: 2_67_900, tests: 1_580 },
];

/** Vehicle mix by category — typical PUCC centre split. */
export const DEMO_CATEGORIES: CategoryCount[] = [
  { key: "bike", label: "Bike", count: 4_280, avgFee: 80 },
  { key: "scooter", label: "Scooter", count: 3_150, avgFee: 80 },
  { key: "car", label: "Car", count: 2_640, avgFee: 150 },
  { key: "auto", label: "Auto-rickshaw", count: 1_120, avgFee: 100 },
  { key: "commercial", label: "Commercial / HCV", count: 490, avgFee: 250 },
];

/** Fuel mix — petrol-heavy two-wheelers dominate most centres. */
export const DEMO_FUELS: CategoryCount[] = [
  { key: "petrol", label: "Petrol", count: 9_420, avgFee: 90 },
  { key: "diesel", label: "Diesel", count: 1_860, avgFee: 180 },
  { key: "cng", label: "CNG / LPG", count: 310, avgFee: 120 },
  { key: "ev", label: "Electric", count: 90, avgFee: 80 },
];

export function formatInr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
