export interface PlanLimits {
    file_storage: number; // bytes
    files: number;
    widgets: number;
    same_integration: number;
    editors: number;
}

export interface Plan {
    id: string;
    name: string;
    price: number;
    limits: PlanLimits;
}

export const TIERS: Plan[] = [
    {
        id: "free",
        name: "Free",
        price: 0,
        limits: {
            file_storage: 50 * 1024 * 1024, // 50MB
            files: 50,
            widgets: 10,
            same_integration: 1,
            editors: 1,
        },
    },
    {
        id: "pro",
        name: "Pro",
        price: 9.99, // Example price
        limits: {
            file_storage: 10 * 1024 * 1024 * 1024, // 10GB
            files: 1000,
            widgets: 100,
            same_integration: 5,
            editors: 10,
        },
    }
];

export const DEFAULT_PLAN_ID = "free";

export function getPlanById(id: string): Plan {
    return TIERS.find((p) => p.id === id) || TIERS.find((p) => p.id === DEFAULT_PLAN_ID)!;
}
