import type { CliArtifact } from '@cloud-agent/cli-interface';
import type { ActionStep } from '../components/ToolActionTray';
import { unescapeContent } from './react-template';

export type PreviewTarget =
  | {
      type: 'dev_server';
      id: string;
      title: string;
      port: number;
      url: string;
      framework?: string;
    }
  | {
      type: 'html_artifact';
      id: string;
      title: string;
      name: string;
      path?: string;
      htmlContent?: string;
    }
  | {
      type: 'react_artifact';
      id: string;
      title: string;
      name: string;
      path?: string;
      code?: string;
    }
  | {
      type: 'project_server';
      id: string;
      title: string;
      framework: string;
      script: string;
    };

const DEV_SERVER_REGEX =
  /(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{3,5})(?:[^\s"'`\)]*)/i;

/**
 * Inspects a turn's content, executed actions, and known session artifacts
 * to discover previewable targets (Live Servers, HTML files, or React components).
 */
export function detectPreviewTarget(options: {
  turnContent?: string;
  actions?: ActionStep[];
  artifacts?: CliArtifact[];
}): PreviewTarget | null {
  const { turnContent = '', actions = [], artifacts = [] } = options;

  // 1. Inspect terminal / command tool outputs for live listening dev server URLs
  for (const action of actions) {
    const rawOutput = `${action.output || ''} ${action.details || ''} ${action.title || ''}`;

    const match = rawOutput.match(DEV_SERVER_REGEX);
    if (match && match[1]) {
      const port = parseInt(match[1], 10);
      if (port >= 1000 && port <= 65535) {
        let framework = 'Dev Server';
        const lowerOut = rawOutput.toLowerCase();
        if (lowerOut.includes('vite')) framework = 'Vite • React';
        else if (lowerOut.includes('next')) framework = 'Next.js';
        else if (lowerOut.includes('uvicorn') || lowerOut.includes('fastapi')) framework = 'FastAPI';
        else if (lowerOut.includes('astro')) framework = 'Astro';

        return {
          type: 'dev_server',
          id: `server_${port}`,
          title: `${framework} (: ${port})`,
          port,
          url: `http://localhost:${port}`,
          framework,
        };
      }
    }
  }

  // Also check turn assistant text for localhost URLs
  const textMatch = turnContent.match(DEV_SERVER_REGEX);
  if (textMatch && textMatch[1]) {
    const port = parseInt(textMatch[1], 10);
    if (port >= 1000 && port <= 65535) {
      return {
        type: 'dev_server',
        id: `server_${port}`,
        title: `Dev Server (: ${port})`,
        port,
        url: `http://localhost:${port}`,
      };
    }
  }

  // 2. Check for Visual Artifacts (HTML, SVG, React) generated in this turn
  for (const action of actions) {
    const isFileCategory =
      action.category === 'file' ||
      action.category === 'edit' ||
      action.toolName === 'write_file' ||
      action.toolName === 'edit_file';

    const rawPath =
      action.args?.Path ||
      action.args?.path ||
      action.args?.filePath ||
      '';
    const cleanPath = String(rawPath).replace(/^["']|["']$/g, '').trim();

    if (cleanPath) {
      if (/\.(html|htm|svg)$/i.test(cleanPath)) {
        const fileName = cleanPath.split(/[\\/]/).pop() || 'preview.html';
        const rawContent = action.args?.Content || action.args?.content || action.args?.Replacement;
        const htmlContent = unescapeContent(rawContent) || undefined;
        return {
          type: 'html_artifact',
          id: `html_${fileName}`,
          title: fileName,
          name: fileName,
          path: cleanPath,
          htmlContent,
        };
      }

      if (
        isFileCategory &&
        /\.(tsx|jsx)$/i.test(cleanPath) &&
        /([A-Z][a-zA-Z0-9]+)\.(tsx|jsx)$/.test(cleanPath)
      ) {
        const fileName = cleanPath.split(/[\\/]/).pop() || 'Component.tsx';
        const rawContent = action.args?.Content || action.args?.content || action.args?.Replacement;
        const code = unescapeContent(rawContent) || undefined;
        return {
          type: 'react_artifact',
          id: `react_${fileName}`,
          title: fileName,
          name: fileName,
          path: cleanPath,
          code,
        };
      }
    }
  }

  // 3. Check session artifacts for recent HTML/SVG deliverables
  for (const art of artifacts) {
    const titleStr = art.title || '';
    const pathStr = art.path || '';
    if (/\.(html|htm|svg)$/i.test(titleStr) || /\.(html|htm|svg)$/i.test(pathStr)) {
      const name = titleStr || pathStr.split(/[\\/]/).pop() || 'preview.html';
      return {
        type: 'html_artifact',
        id: `art_${art.id || name}`,
        title: art.summary || name,
        name,
        path: art.path,
      };
    }
  }

  // 4. Check if turn created or edited a React/Vite project without running a server yet
  for (const action of actions) {
    const rawPath =
      action.args?.Path ||
      action.args?.path ||
      action.args?.filePath ||
      action.title ||
      '';
    const filePath = String(rawPath).replace(/^["']|["']$/g, '').trim();
    if (
      filePath.includes('package.json') ||
      filePath.includes('vite.config') ||
      filePath.includes('App.tsx')
    ) {
      return {
        type: 'project_server',
        id: 'proj_react',
        title: 'React Project (Vite)',
        framework: 'Vite • React',
        script: 'dev',
      };
    }
  }

  return null;
}
