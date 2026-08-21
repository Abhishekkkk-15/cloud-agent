import { Link } from "react-router-dom"
import { ClockIcon, GlobeIcon, LockIcon, StarIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { languageLabels } from "@/data/mock"
import { useProjectStore } from "@/stores/project-store"
import type { Project } from "@/types/schemas"
import { cn } from "@/lib/utils"

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return "Just now"
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function ProjectCard({ project }: { project: Project }) {
  const star = useProjectStore((s) => s.star)

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex flex-col gap-1">
            <CardTitle className="truncate">
              <Link
                to={`/workspace/${project.id}`}
                className="hover:underline"
              >
                {project.name}
              </Link>
            </CardTitle>
            <CardDescription className="line-clamp-2">
              {project.description}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={project.isStarred ? "Unstar" : "Star"}
            onClick={() => star(project.id)}
          >
            <StarIcon
              className={cn(project.isStarred && "fill-current text-foreground")}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Badge variant="secondary">
          {languageLabels[project.language] ?? project.language}
        </Badge>
        <Badge variant="outline" className="gap-1">
          {project.visibility === "public" ? (
            <GlobeIcon className="size-3" />
          ) : (
            <LockIcon className="size-3" />
          )}
          {project.visibility}
        </Badge>
      </CardContent>
      <CardFooter className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <StarIcon className="size-3.5" />
          {project.starCount}
        </span>
        <span className="inline-flex items-center gap-1">
          <ClockIcon className="size-3.5" />
          {formatRelative(project.updatedAt)}
        </span>
        <Button
          size="sm"
          render={<Link to={`/workspace/${project.id}`} />}
          nativeButton={false}
        >
          Open
        </Button>
      </CardFooter>
    </Card>
  )
}
