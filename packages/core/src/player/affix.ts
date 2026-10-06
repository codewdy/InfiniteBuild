export namespace Affix {
  export type Tier = {
    min: number;
    max: number;
  };
  export type Definition<T> = {
    name: string;
    apply: T;
    tier: Tier[];
  };
  export type Definitions<T> = Record<string, Definition<T>>;
  export type Spec = {
    id: string;
    tier: number;
    param: number;
  };
}
