import { Link } from "react-router-dom"
import {
  CloudIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { useTheme } from "@/components/theme-provider"
import { useAuthStore } from "@/stores/auth-store"
import { cn } from "@/lib/utils"

type AppHeaderProps = {
  className?: string
  dense?: boolean
}

export function AppHeader({ className, dense }: AppHeaderProps) {
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const { theme, setTheme } = useTheme()
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <header
      className={cn(
        "flex items-center justify-between border-b bg-background/80 px-4 backdrop-blur-md",
        dense ? "h-12" : "h-14",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 font-medium">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CloudIcon className="size-4" />
          </span>
          <span>Cloud Agent</span>
        </Link>
        {user && (
          <>
            <Separator orientation="vertical" className="h-5" />
            <Button
              variant="ghost"
              size="sm"
              render={<Link to="/dashboard" />}
              nativeButton={false}
            >
              <LayoutDashboardIcon data-icon="inline-start" />
              Dashboard
            </Button>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </Button>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm" className="gap-2 px-1.5" />
              }
            >
              <Avatar className="size-7">
                {user.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                ) : null}
                <AvatarFallback>
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline">{user.username}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  {user.name}
                  <div className="font-normal text-muted-foreground">
                    {user.email}
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  render={<Link to="/dashboard" />}
                >
                  <LayoutDashboardIcon />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>
                  <LogOutIcon />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button size="sm" render={<Link to="/login" />} nativeButton={false}>
            Sign in
          </Button>
        )}
      </div>
    </header>
  )
}
