import { act, renderHook } from "@testing-library/react"
import { useIsMobile } from "@/hooks/use-mobile"

describe("useIsMobile", () => {
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it("returns true when viewport width is below breakpoint", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 600 })
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: true,
      media: "",
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }))

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(true)
  })

  it("returns false when viewport width is at or above breakpoint", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 })
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }))

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(false)
  })

  it("updates when matchMedia change fires", () => {
    let changeHandler: (() => void) | null = null
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 })

    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: window.innerWidth < 768,
      media: "",
      addEventListener: (_event: string, listener: () => void) => {
        changeHandler = listener
      },
      removeEventListener: jest.fn(),
    }))

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(false)

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 500 })

    act(() => {
      changeHandler?.()
    })

    expect(result.current).toBe(true)
  })
})
