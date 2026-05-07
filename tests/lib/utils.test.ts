import { cn } from "@/lib/utils"

describe("cn", () => {
  it("merges class values and removes falsy values", () => {
    const result = cn("px-4", undefined, false, "py-2", null, "font-bold")

    expect(result).toBe("px-4 py-2 font-bold")
  })

  it("resolves tailwind conflicts with last class winning", () => {
    const result = cn("p-2", "p-4", "text-left", "text-right")

    expect(result).toBe("p-4 text-right")
  })
})
