/**
 * Generates standalone, self-contained HTML for previewing web deliverables in a WebView.
 * Automatically handles raw HTML, SVG documents, and standalone React/JSX components.
 */

export function unescapeContent(raw?: unknown): string {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw.trim();

  // If it's a JSON-stringified string (e.g. "\"<!DOCTYPE html>\\n...\"")
  if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'string') {
        text = parsed;
      }
    } catch {
      text = text.slice(1, -1);
    }
  }

  // Handle literal escaped newlines if real newlines don't exist
  if (text.includes('\\n') && !text.includes('\n')) {
    text = text
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"');
  }

  return text;
}

export function isHtmlDocument(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim().toLowerCase();
  return (
    trimmed.startsWith('<!doctype html') ||
    trimmed.startsWith('<html') ||
    (trimmed.includes('<head') && trimmed.includes('<body'))
  );
}

export function isSvgDocument(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim().toLowerCase();
  return trimmed.startsWith('<svg') || (trimmed.startsWith('<?xml') && trimmed.includes('<svg'));
}

export function prepareHtmlForMobile(html: string): string {
  if (!html) return '';
  let prepared = unescapeContent(html);

  // If it's an HTML document and lacks a viewport meta tag, inject one inside <head>
  if (isHtmlDocument(prepared) && !prepared.includes('name="viewport"') && !prepared.includes("name='viewport'")) {
    const viewportMeta = '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />';
    if (prepared.includes('<head>')) {
      prepared = prepared.replace('<head>', `<head>${viewportMeta}`);
    } else if (prepared.includes('<head ')) {
      prepared = prepared.replace(/<head[^>]*>/, `$&${viewportMeta}`);
    } else if (prepared.includes('<html>') || prepared.includes('<html ')) {
      prepared = prepared.replace(/<html[^>]*>/, `$&<head>${viewportMeta}</head>`);
    }
  }

  return prepared;
}

export function wrapSvgInHtml(svgContent: string, isDark: boolean = true): string {
  const bg = isDark ? '#141414' : '#ffffff';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: ${bg};
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
      overflow: auto;
    }
    svg {
      max-width: 100%;
      height: auto;
      display: block;
    }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`;
}

export function wrapReactComponentInHtml(
  code: string,
  options: { isDark?: boolean; title?: string } = {}
): string {
  const { isDark = true, title = 'React Live Preview' } = options;
  const bg = isDark ? '#141414' : '#ffffff';
  const text = isDark ? '#f5f5f5' : '#111010';

  // Sanitize code string: extract component name if exported default
  let cleanCode = code;
  let componentName = 'App';

  const defaultMatch = code.match(/export\s+default\s+function\s+([A-Za-z0-9_]+)/);
  if (defaultMatch && defaultMatch[1]) {
    componentName = defaultMatch[1];
    cleanCode = cleanCode.replace(/export\s+default\s+function/, 'function');
  } else {
    const constMatch = code.match(/export\s+default\s+([A-Za-z0-9_]+)/);
    if (constMatch && constMatch[1]) {
      componentName = constMatch[1];
      cleanCode = cleanCode.replace(/export\s+default\s+[A-Za-z0-9_]+;?/, '');
    }
  }

  // Strip standalone export keywords that could trip in-browser eval
  cleanCode = cleanCode.replace(/^export\s+(default\s+)?/gm, '');

  return `<!DOCTYPE html>
<html class="${isDark ? 'dark' : ''}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            background: '${bg}',
            foreground: '${text}',
          }
        }
      }
    };
  </script>
  <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@18.3.1?dev",
        "react-dom/client": "https://esm.sh/react-dom@18.3.1/client?dev",
        "lucide-react": "https://esm.sh/lucide-react@0.475.0",
        "clsx": "https://esm.sh/clsx",
        "tailwind-merge": "https://esm.sh/tailwind-merge"
      }
    }
  </script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      background-color: ${bg};
      color: ${text};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    #root { min-height: 100vh; }
    #preview-error {
      display: none;
      padding: 16px;
      margin: 16px;
      border-radius: 8px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #ef4444;
      font-family: monospace;
      font-size: 13px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div id="preview-error"></div>
  <div id="root"></div>

  <script>
    window.onerror = function(msg, url, line, col, error) {
      var errDiv = document.getElementById('preview-error');
      if (errDiv) {
        errDiv.style.display = 'block';
        errDiv.textContent = 'Preview Runtime Error:\n' + (error && error.stack ? error.stack : msg);
      }
      return false;
    };
  </script>

  <script type="text/babel" data-type="module">
    import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
    import { createRoot } from 'react-dom/client';
    import * as LucideIcons from 'lucide-react';

    try {
      ${cleanCode}

      const TargetComponent = typeof ${componentName} !== 'undefined' ? ${componentName} : (function() {
        return function Fallback() {
          return React.createElement('div', { className: 'p-4 text-center text-muted-foreground' }, 'Component loaded successfully');
        };
      })();

      const root = createRoot(document.getElementById('root'));
      root.render(React.createElement(TargetComponent));
    } catch (err) {
      console.error('Render error:', err);
      const errDiv = document.getElementById('preview-error');
      if (errDiv) {
        errDiv.style.display = 'block';
        errDiv.textContent = 'Render Initialization Error:\n' + (err && err.stack ? err.stack : err.message);
      }
    }
  </script>
</body>
</html>`;
}
