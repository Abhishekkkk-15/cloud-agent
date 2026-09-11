/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

export type Theme = "dark" | "light" | "system" | "ocean" | "forest"
type ColorMode = "dark" | "light"

export type ThemeOption = {
  value: Theme
  label: string
  /** Visual swatch for the picker */
  swatch: string
  description: string
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "light",
    label: "Light",
    swatch: "#f4f4f5",
    description: "Clean light surface",
  },
  {
    value: "dark",
    label: "Dark",
    swatch: "#18181b",
    description: "Neutral dark",
  },
  {
    value: "ocean",
    label: "Ocean",
    swatch: "#0c1a24",
    description: "Cool slate teal",
  },
  {
    value: "forest",
    label: "Forest",
    swatch: "#111a14",
    description: "Deep moss green",
  },
  {
    value: "system",
    label: "System",
    swatch: "linear-gradient(135deg, #f4f4f5 50%, #18181b 50%)",
    description: "Match OS preference",
  },
]

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  disableTransitionOnChange?: boolean
}

type ThemeProviderState = {
  theme: Theme
  /** Effective light/dark mode after resolving system + palette themes */
  colorMode: ColorMode
  setTheme: (theme: Theme) => void
  themes: ThemeOption[]
}

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"
const THEME_VALUES: Theme[] = ["dark", "light", "system", "ocean", "forest"]
const THEME_CLASS_NAMES = ["light", "dark", "theme-ocean", "theme-forest"] as const

const ThemeProviderContext = React.createContext<
  ThemeProviderState | undefined
>(undefined)

function isTheme(value: string | null): value is Theme {
  if (value === null) {
    return false
  }

  return THEME_VALUES.includes(value as Theme)
}

function getSystemTheme(): ColorMode {
  if (window.matchMedia(COLOR_SCHEME_QUERY).matches) {
    return "dark"
  }

  return "light"
}

/** Maps stored theme → root classes + color mode for dark: utilities / Monaco */
function resolveThemeApplication(theme: Theme): {
  classes: string[]
  colorMode: ColorMode
} {
  if (theme === "system") {
    const mode = getSystemTheme()
    return { classes: [mode], colorMode: mode }
  }
  if (theme === "light") {
    return { classes: ["light"], colorMode: "light" }
  }
  if (theme === "dark") {
    return { classes: ["dark"], colorMode: "dark" }
  }
  if (theme === "ocean") {
    return { classes: ["dark", "theme-ocean"], colorMode: "dark" }
  }
  // forest
  return { classes: ["dark", "theme-forest"], colorMode: "dark" }
}

function disableTransitionsTemporarily() {
  const style = document.createElement("style")
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;transition:none!important}"
    )
  )
  document.head.appendChild(style)

  return () => {
    window.getComputedStyle(document.body)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        style.remove()
      })
    })
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  const editableParent = target.closest(
    "input, textarea, select, [contenteditable='true']"
  )
  if (editableParent) {
    return true
  }

  return false
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "theme",
  disableTransitionOnChange = true,
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    const storedTheme = localStorage.getItem(storageKey)
    if (isTheme(storedTheme)) {
      return storedTheme
    }

    return defaultTheme
  })

  const [colorMode, setColorMode] = React.useState<ColorMode>(() => {
    if (typeof window === "undefined") return "dark"
    return resolveThemeApplication(
      isTheme(localStorage.getItem(storageKey))
        ? (localStorage.getItem(storageKey) as Theme)
        : defaultTheme
    ).colorMode
  })

  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      localStorage.setItem(storageKey, nextTheme)
      setThemeState(nextTheme)
    },
    [storageKey]
  )

  const applyTheme = React.useCallback(
    (nextTheme: Theme) => {
      const root = document.documentElement
      const { classes, colorMode: nextMode } = resolveThemeApplication(nextTheme)
      const restoreTransitions = disableTransitionOnChange
        ? disableTransitionsTemporarily()
        : null

      root.classList.remove(...THEME_CLASS_NAMES)
      root.classList.add(...classes)
      setColorMode(nextMode)

      if (restoreTransitions) {
        restoreTransitions()
      }
    },
    [disableTransitionOnChange]
  )

  React.useEffect(() => {
    applyTheme(theme)

    if (theme !== "system") {
      return undefined
    }

    const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY)
    const handleChange = () => {
      applyTheme("system")
    }

    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [theme, applyTheme])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      if (event.key.toLowerCase() !== "d") {
        return
      }

      // Cycle: light → dark → ocean → forest → light (skip system on hotkey)
      const cycle: Theme[] = ["light", "dark", "ocean", "forest"]
      setThemeState((currentTheme) => {
        const from =
          currentTheme === "system" ? getSystemTheme() : currentTheme
        const idx = cycle.indexOf(from as Theme)
        const nextTheme = cycle[(idx >= 0 ? idx + 1 : 0) % cycle.length]!
        localStorage.setItem(storageKey, nextTheme)
        return nextTheme
      })
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [storageKey])

  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) {
        return
      }

      if (event.key !== storageKey) {
        return
      }

      if (isTheme(event.newValue)) {
        setThemeState(event.newValue)
        return
      }

      setThemeState(defaultTheme)
    }

    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [defaultTheme, storageKey])

  const value = React.useMemo(
    () => ({
      theme,
      colorMode,
      setTheme,
      themes: THEME_OPTIONS,
    }),
    [theme, colorMode, setTheme]
  )

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}
