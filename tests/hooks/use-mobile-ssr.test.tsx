/** @jest-environment node */

import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { useIsMobile } from "@/hooks/use-mobile"

function Probe() {
  const isMobile = useIsMobile()
  return createElement("span", null, isMobile ? "1" : "0")
}

describe("useIsMobile server render", () => {
  it("initializes to not mobile when window is undefined", () => {
    expect(typeof globalThis.window).toBe("undefined")
    const html = renderToString(createElement(Probe))
    expect(html).toBe("<span>0</span>")
  })
})
