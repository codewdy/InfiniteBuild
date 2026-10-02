export namespace Status {
  export const FieldName = ["maxHp", "attack", "defense"] as const;
  export type Field = (typeof FieldName)[number];

  export type FieldStatus = {
    base: number;
    inc: number;
    more: number;
  };

  export type FieldModifier = Partial<FieldStatus>;
  export type Modifier = Partial<Record<Field, FieldModifier>>;
  export type Status = Record<Field, FieldModifier>;
  export type RawStatus = Record<Field, number>;
  export type StatusConfig = Partial<Record<Field, number>>;

  export function createByConfig(config: StatusConfig): Status {
    return Object.fromEntries(
      FieldName.map((field) => [
        field,
        { base: config[field] ?? 0, inc: 0, more: 0 },
      ]),
    ) as Status;
  }

  export function apply(status: Status, modifiers: Modifier[]): Status {
    return Object.fromEntries(
      FieldName.map((field) => {
        let base = status[field].base ?? 0;
        let inc = status[field].inc ?? 0;
        let multiplier = 1 + (status[field].more ?? 0);
        for (const modifier of modifiers) {
          const value = modifier[field];
          if (!value) continue;
          base += value.base ?? 0;
          inc += value.inc ?? 0;
          multiplier *= 1 + (value.more ?? 0);
        }
        return [field, { base, inc, more: multiplier - 1 }];
      }),
    ) as Status;
  }

  export function resolve(status: Status): RawStatus {
    return Object.fromEntries(
      FieldName.map((field) => {
        const value = status[field];
        return [
          field,
          (value.base ?? 0) * (1 + (value.inc ?? 0)) * (1 + (value.more ?? 0)),
        ];
      }),
    ) as RawStatus;
  }
}
