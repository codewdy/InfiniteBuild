import { Text } from "pixi.js";
export function createText(value: string, size: number, fill: number): Text {
  return new Text({
    text: value,
    style: { fontFamily: "system-ui, sans-serif", fontSize: size, fill },
  });
}
