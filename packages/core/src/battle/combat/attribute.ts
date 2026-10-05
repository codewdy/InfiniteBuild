export type Attribute = {
  base: number;
  inc: number;
  more: number;
};

export namespace Attribute {
  export type Modifier = Partial<Attribute>;
  export type Dict<Field extends string = string> = Record<Field, Attribute>;
  export type DictModifier<Field extends string = string> = Partial<
    Record<Field, Modifier>
  >;

  export function createByRaw(base: number): Attribute {
    return { base, inc: 0, more: 0 };
  }

  export function createDictByRaw<Field extends string>(
    fields: readonly Field[],
    source: Partial<Record<NoInfer<Field>, number>> = {},
  ): Dict<Field> {
    return Object.fromEntries(
      fields.map((field) => [
        field,
        createByRaw(source[field] ?? 0),
      ]),
    ) as Dict<Field>;
  }

  export function merge(...sources: (Modifier | undefined)[]): Attribute {
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

  export function mergeDict<Field extends string>(
    source: Dict<Field>,
    ...sources: (DictModifier<NoInfer<Field>> | undefined)[]
  ): Dict<Field>;
  export function mergeDict<Field extends string = string>(
    ...sources: (DictModifier<Field> | undefined)[]
  ): Partial<Dict<Field>>;
  export function mergeDict<Field extends string = string>(
    ...sources: (DictModifier<Field> | undefined)[]
  ): Partial<Dict<Field>> {
    const fields = new Set<Field>();
    for (const source of sources) {
      for (const field of Object.keys(source ?? {}) as Field[]) {
        fields.add(field);
      }
    }
    return Object.fromEntries(
      [...fields].map((field) => [
        field,
        merge(...sources.map((source) => source?.[field])),
      ]),
    ) as Partial<Dict<Field>>;
  }

  export function resolve(value: Modifier): number {
    return (value.base ?? 0) * (1 + (value.inc ?? 0)) * (1 + (value.more ?? 0));
  }

  export function resolveDict<Field extends string>(
    source: Record<Field, Modifier>,
  ): Record<Field, number>;
  export function resolveDict<Field extends string = string>(
    source: DictModifier<Field>,
  ): Partial<Record<Field, number>>;
  export function resolveDict<Field extends string = string>(
    source: DictModifier<Field>,
  ): Partial<Record<Field, number>> {
    return Object.fromEntries(
      (Object.keys(source) as Field[]).map((field) => [
        field,
        resolve(source[field] ?? {}),
      ]),
    ) as Partial<Record<Field, number>>;
  }
}
