export type Attribute = {
  base?: number;
  inc?: number;
  more?: number;
};

export namespace Attribute {
  export type Dict = Record<string, Attribute>;

  export function createDictByRaw(source: Record<string, number> = {}): Dict {
    return Object.fromEntries(
      Object.entries(source).map(([key, base]) => [key, { base }]),
    );
  }

  export function merge(...sources: (Attribute | undefined)[]): Attribute {
    let base = 0;
    let inc = 0;
    let multiplier = 1;
    for (const value of sources) {
      if (!value) continue;
      base += value.base ?? 0;
      inc += value.inc ?? 0;
      multiplier *= 1 + (value.more ?? 0);
    }
    return { base, inc, more: multiplier - 1 };
  }

  export function mergeDict(...sources: (Dict | undefined)[]): Dict {
    const fields = new Set<string>();
    for (const source of sources) {
      for (const field of Object.keys(source ?? {})) {
        fields.add(field);
      }
    }
    return Object.fromEntries(
      [...fields].map((field) => [
        field,
        merge(...sources.map((source) => source?.[field])),
      ]),
    );
  }

  export function resolve(value: Attribute | undefined): number {
    return (
      (value?.base ?? 0) * (1 + (value?.inc ?? 0)) * (1 + (value?.more ?? 0))
    );
  }

  export function resolveDict(source: Dict): Record<string, number> {
    return Object.fromEntries(
      Object.entries(source).map(([key, value]) => [key, resolve(value)]),
    );
  }
}
