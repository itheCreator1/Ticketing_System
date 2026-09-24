import en from "./messages/en.json";

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<typeof en>;

export function t(
  key: MessageKey,
  vars: Record<string, string | number> = {},
): string {
  let node: unknown = en;
  for (const part of key.split(".")) {
    node =
      node !== null && typeof node === "object" && Object.hasOwn(node, part)
        ? Reflect.get(node, part)
        : undefined;
  }
  if (typeof node !== "string") throw new Error(`Missing message: ${key}`);
  const values = new Map(Object.entries(vars));
  return node.replace(/\{(\w+)\}/g, (match, name: string) =>
    values.has(name) ? String(values.get(name)) : match,
  );
}
