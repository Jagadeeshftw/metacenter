import { ClarityType, type ClarityValue } from "@stacks/transactions";

/**
 * Clarity value -> plain JSON. Integers become decimal strings (never lossy
 * numbers); optionals become value | null; responses become {ok} | {err}.
 */
export function toPlain(cv: ClarityValue): any {
  switch (cv.type) {
    case ClarityType.UInt:
    case ClarityType.Int:
      return BigInt(cv.value).toString();
    case ClarityType.BoolTrue:
      return true;
    case ClarityType.BoolFalse:
      return false;
    case ClarityType.OptionalNone:
      return null;
    case ClarityType.OptionalSome:
      return toPlain(cv.value);
    case ClarityType.ResponseOk:
      return { ok: toPlain(cv.value) };
    case ClarityType.ResponseErr:
      return { err: toPlain(cv.value) };
    case ClarityType.Buffer:
      return "0x" + cv.value;
    case ClarityType.StringASCII:
    case ClarityType.StringUTF8:
      return cv.value;
    case ClarityType.PrincipalStandard:
    case ClarityType.PrincipalContract:
      return cv.value;
    case ClarityType.List:
      return cv.value.map(toPlain);
    case ClarityType.Tuple:
      return Object.fromEntries(Object.entries(cv.value).map(([k, v]) => [k, toPlain(v)]));
    default:
      throw new Error(`unhandled clarity type ${(cv as any).type}`);
  }
}
