export type QueryOperator =
  | "equal"
  | "notEqual"
  | "lessThan"
  | "lessThanEqual"
  | "greaterThan"
  | "greaterThanEqual"
  | "isNotNull"
  | "limit"
  | "offset"
  | "orderAsc"
  | "orderDesc";

export type QuerySpec = {
  op: QueryOperator;
  field?: string;
  value?: unknown;
};

function spec(query: QuerySpec): string {
  return query as unknown as string;
}

export const Query = {
  equal(field: string, value: unknown): string {
    return spec({ op: "equal", field, value });
  },
  notEqual(field: string, value: unknown): string {
    return spec({ op: "notEqual", field, value });
  },
  lessThan(field: string, value: unknown): string {
    return spec({ op: "lessThan", field, value });
  },
  lessThanEqual(field: string, value: unknown): string {
    return spec({ op: "lessThanEqual", field, value });
  },
  greaterThan(field: string, value: unknown): string {
    return spec({ op: "greaterThan", field, value });
  },
  greaterThanEqual(field: string, value: unknown): string {
    return spec({ op: "greaterThanEqual", field, value });
  },
  isNotNull(field: string): string {
    return spec({ op: "isNotNull", field });
  },
  limit(value: number): string {
    return spec({ op: "limit", value });
  },
  offset(value: number): string {
    return spec({ op: "offset", value });
  },
  orderAsc(field: string): string {
    return spec({ op: "orderAsc", field });
  },
  orderDesc(field: string): string {
    return spec({ op: "orderDesc", field });
  },
};

export function parseQuerySpecs(queries: unknown[] = []): QuerySpec[] {
  return queries.filter((query): query is QuerySpec => {
    return typeof query === "object" && query !== null && "op" in query;
  });
}

export const ID = {
  unique(): string {
    return crypto.randomUUID();
  },
};

export const Permission = {
  read(value: string): string {
    return `read:${value}`;
  },
  update(value: string): string {
    return `update:${value}`;
  },
  delete(value: string): string {
    return `delete:${value}`;
  },
};

export const Role = {
  any(): string {
    return "any";
  },
  user(userId: string): string {
    return `user:${userId}`;
  },
  label(label: string): string {
    return `label:${label}`;
  },
};
