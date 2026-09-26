import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("csv", () => {
  it("neutralises formula triggers", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("  =HYPERLINK()")).toBe("'  =HYPERLINK()");
  });
  it("quotes and escapes", () => {
    expect(csvCell('He said "hi", ok')).toBe('"He said ""hi"", ok"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
  });
  it("handles nulls, arrays and objects", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(["a", "b"])).toBe("a; b");
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
  });
  it("builds rows with CRLF", () => {
    expect(toCsv(["a", "b"], [[1, "=x"]])).toBe("a,b\r\n1,'=x\r\n");
  });
});
