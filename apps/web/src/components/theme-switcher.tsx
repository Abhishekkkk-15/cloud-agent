import { CheckIcon, PaletteIcon } from "lucide-react"

import { useTheme, type Theme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type ThemeSwitcherProps = {
  className?: string
}

export function ThemeSwitcher({ className }: ThemeSwitcherProps) {
  const { theme, setTheme, themes } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={className}
            aria-label="Choose theme"
          />
        }
      >
        <PaletteIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          {themes.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value as Theme)}
              className="gap-2"
            >
              <span
                className="size-3.5 shrink-0 rounded-full border border-border"
                style={{ background: option.swatch }}
                aria-hidden
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="leading-none">{option.label}</span>
                <span className="text-[10px] text-muted-foreground leading-none">
                  {option.description}
                </span>
              </span>
              <CheckIcon
                className={cn(
                  "size-3.5 opacity-0",
                  theme === option.value && "opacity-100"
                )}
              />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
