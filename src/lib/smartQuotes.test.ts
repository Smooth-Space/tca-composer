import { describe, expect, test } from "bun:test";
import {
  LEFT_DOUBLE,
  LEFT_SINGLE,
  RIGHT_DOUBLE,
  RIGHT_SINGLE,
  applySmartQuoteAt,
  isStraightQuote,
  smartQuoteAt,
  smartQuotes,
} from "@/lib/smartQuotes";
import { IT_CLOSE, IT_OPEN } from "@/lib/titleItalic";

describe("isStraightQuote", () => {
  test("accepts only the two typewriter marks", () => {
    expect(isStraightQuote("'")).toBe(true);
    expect(isStraightQuote('"')).toBe(true);
    for (const ch of [LEFT_SINGLE, RIGHT_SINGLE, LEFT_DOUBLE, RIGHT_DOUBLE, "a", "", "′", "″"]) {
      expect(isStraightQuote(ch)).toBe(false);
    }
  });
});

describe("apostrophes close", () => {
  test.each([
    ["Austin's", "Austin’s"],
    ["don't", "don’t"],
    ["artists' works", "artists’ works"],
    ["O'Keeffe", "O’Keeffe"],
  ])("%s -> %s", (input, expected) => {
    expect(smartQuotes(input)).toBe(expected);
  });
});

describe("quotation marks pair up", () => {
  test.each([
    ['"Hello"', "“Hello”"],
    ["'Hello'", "‘Hello’"],
    ['He said "hello" loudly', "He said “hello” loudly"],
    ['("quoted")', "(“quoted”)"],
    ['A "b" and "c"', "A “b” and “c”"],
  ])("%s -> %s", (input, expected) => {
    expect(smartQuotes(input)).toBe(expected);
  });

  test("a quote inside a quote nests correctly", () => {
    expect(smartQuotes(`"He said 'yes' to me"`)).toBe("“He said ‘yes’ to me”");
  });
});

describe("what counts as an opening position", () => {
  test("start of string opens", () => {
    expect(smartQuoteAt('"x', 0)).toBe(LEFT_DOUBLE);
    expect(smartQuoteAt("'x", 0)).toBe(LEFT_SINGLE);
  });

  test.each([" ", "\n", "\t"])("whitespace %j opens", (ws) => {
    expect(smartQuoteAt(`a${ws}"`, 2)).toBe(LEFT_DOUBLE);
  });

  test.each(["(", "[", "{", "<", "—", "–", "-"])("%s opens", (prev) => {
    expect(smartQuoteAt(`${prev}"`, 1)).toBe(LEFT_DOUBLE);
  });

  test.each(["a", "Z", "1", ".", ",", "!", "?", ")", "]"])("%s closes", (prev) => {
    expect(smartQuoteAt(`${prev}"`, 1)).toBe(RIGHT_DOUBLE);
  });
});

describe("italic sentinels are invisible to the rule", () => {
  // Markup lives inline in the title string. A quote opening an italic run sits
  // right after a sentinel; if the rule saw the sentinel it would wrongly close.
  test("a quote after IT_OPEN still opens when a space precedes the run", () => {
    expect(smartQuoteAt(`said ${IT_OPEN}"`, 5 + IT_OPEN.length)).toBe(LEFT_DOUBLE);
  });

  test("a quote after IT_CLOSE still closes when a letter precedes it", () => {
    expect(smartQuoteAt(`hello${IT_CLOSE}"`, 5 + IT_CLOSE.length)).toBe(RIGHT_DOUBLE);
  });

  test("sentinels stacked together are all skipped", () => {
    expect(smartQuoteAt(`x ${IT_CLOSE}${IT_OPEN}'`, 4)).toBe(LEFT_SINGLE);
  });
});

describe("known limitations, pinned deliberately", () => {
  // The standard rule cannot tell an elision from an opening quote — both follow
  // a space. Pinned so the behaviour is a decision on record, not a surprise.
  test("elisions get an opening mark where a closing one belongs", () => {
    expect(smartQuotes("the '90s")).toBe("the ‘90s");
    expect(smartQuotes("rock 'n' roll")).toBe("rock ‘n’ roll");
  });
});

describe("applySmartQuoteAt", () => {
  test("is always length-preserving, which keeps the caret valid", () => {
    const s = `say "what"`;
    for (let i = 0; i < s.length; i++) {
      expect(applySmartQuoteAt(s, i).length).toBe(s.length);
    }
  });

  test("leaves non-quote characters untouched", () => {
    expect(applySmartQuoteAt("abc", 1)).toBe("abc");
  });

  test("ignores out-of-range indices instead of throwing", () => {
    expect(applySmartQuoteAt("a", -1)).toBe("a");
    expect(applySmartQuoteAt("a", 5)).toBe("a");
    expect(applySmartQuoteAt("", 0)).toBe("");
  });

  test("converts only the character at the index", () => {
    expect(applySmartQuoteAt(`"a"`, 0)).toBe(`“a"`);
  });
});

describe("characters that must be left alone", () => {
  test("prime and double-prime pass through, so dimensions survive", () => {
    expect(smartQuotes("36 × 24″")).toBe("36 × 24″");
    expect(smartQuotes("6′2″")).toBe("6′2″");
  });

  test("already-curly text is unchanged", () => {
    const curly = "“Austin’s” ‘best’";
    expect(smartQuotes(curly)).toBe(curly);
  });

  test("text with no quotes is unchanged", () => {
    expect(smartQuotes("The Contemporary Austin")).toBe("The Contemporary Austin");
    expect(smartQuotes("")).toBe("");
  });
});
