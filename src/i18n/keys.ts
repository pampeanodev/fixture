import type { Messages } from "./locales/es";

type Path<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends object
      ? Path<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];

export type MessageKey = Path<Messages>;

export type PluralBaseKey = {
  [K in MessageKey]: K extends `${infer Base}One` ? Base : never;
}[MessageKey];

export type Vars = Record<string, string | number>;
