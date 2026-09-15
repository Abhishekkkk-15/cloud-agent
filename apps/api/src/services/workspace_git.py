from pathlib import Path
from typing import Optional,Dict,List
import os
import shutil
import subprocess
import sys
from urllib.parse import urlparse, urlunparse
import re
import tempfile
import stat
import base64

class WorkspaceGitError(Exception):
    pass

_ASKPASS_PY = r"""import os
import sys

prompt = " ".join(sys.argv[1:]).lower()
if "username" in prompt:
    sys.stdout.write(os.environ.get("GIT_USERNAME", "x-access-token"))
else:
    # Password / passphrases / Token prompts
    sys.stdout.write(os.environ.get("GIT_PASSWORD", ""))
"""

class WorkspaceGitService:
    def __init__(self,host_path:Path) -> None:
        self.host_path = host_path
        
    def _run(
        self,
        args: list[str],
        env: Optional[Dict[str, str]] = None,
        check: bool = True,
        *,
        cwd: Path | None = None,
        use_git_c: bool = True,
    ):
        run_env = {**os.environ}
        if env:
            run_env.update(env)

        if use_git_c:
            if not self.host_path.exists():
                raise WorkspaceGitError(f"Directory does not exist : {self.host_path}")
            cmd = [
                "git",
                "-C",
                str(self.host_path),
                "-c",
                f"core.hooksPath={os.devnull}",
                *args,
            ]
            run_cwd = None
        else:
            # Used by clone: destination may not exist yet; run from parent.
            run_cwd = cwd or self.host_path.parent
            run_cwd.mkdir(parents=True, exist_ok=True)
            cmd = ["git", "-c", f"core.hooksPath={os.devnull}", *args]

        try:
            result = subprocess.run(
                cmd,
                cwd=str(run_cwd) if run_cwd is not None else None,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=run_env,
                check=False,
            )
            if check and result.returncode != 0:
                raise WorkspaceGitError(
                    f"Git command failed: {' '.join(cmd)}\n"
                    f"Exit Code: {result.returncode}\n"
                    f"Error: {result.stderr.strip()}"
                )
            return result
        except FileNotFoundError:
            raise WorkspaceGitError("Git binary not found on the host system.")
        
    def init(self) -> None:
        if not self.is_git_repo():
            self._run(["init","-b","main"])
            
    def is_git_repo(self) -> bool:
        git_dir = self.host_path/".git"
        if not git_dir.exists():
            return False
        result = self._run(["rev-parse", "--is-inside-work-tree"],check=False)
        return result.returncode == 0 and result.stdout.strip() == "true"
    
    def ensure_gitignore(self,default_entries:Optional[list[str]]=None) ->None:
        gitignore_path = self.host_path / ".gitignore"
        entries = default_entries or [".DS_Store", "node_modules/", "__pycache__/", "*.pyc", ".env"]
        if not gitignore_path.exists():
            gitignore_path.write_text("\n".join(entries) + "\n", encoding="utf-8")
        else:
            existing_content = gitignore_path.read_text(encoding="utf-8",errors="replace")
            missing_entries = [e for e in entries if e not in existing_content]
            if missing_entries:
                with gitignore_path.open("a",encoding="utf-8") as f:
                    f.write("\n" + "\n".join(missing_entries)+"\n")

    
    def has_changes(self) -> bool:
        result = self._run(["status","--porcelain"])
        return len(result.stdout.strip()) > 0

    def change_summary(self, *, max_len: int = 2500) -> str:
        """Working-tree change summary for commit-message generation (before commit)."""
        if not self.host_path.exists():
            return ""
        chunks: list[str] = []
        status = self._run(["status", "--porcelain"], check=False)
        if status.returncode == 0 and (status.stdout or "").strip():
            chunks.append("status:\n" + status.stdout.strip())

        # Prefer diff against HEAD when history exists so renames/stats are meaningful.
        head = self._run(["rev-parse", "--verify", "HEAD"], check=False)
        if head.returncode == 0:
            diff = self._run(["diff", "--stat", "HEAD"], check=False)
        else:
            diff = self._run(["diff", "--stat"], check=False)
        if diff.returncode == 0 and (diff.stdout or "").strip():
            chunks.append("diff --stat:\n" + diff.stdout.strip())

        text = "\n\n".join(chunks).strip()
        if len(text) > max_len:
            return text[: max_len - 3].rstrip() + "..."
        return text
    
    def commit_all(self,messages:str,author_name:str = "Cloud Agent",author_email:str = "agent@users.noreply.github.com") -> bool:
        if not self.has_changes():
            return False
        self._run(["add","-A"])
        
        commit_env = {
            "GIT_AUTHOR_NAME":author_name,
            "GIT_AUTHOR_EMAIL":author_email,
            "GIT_COMMITTER_NAME":author_name,
            "GIT_COMMITTER_EMAIL":author_email
        }
        self._run(["commit","--no-verify","-m",messages],
                  env=commit_env)
        return True
    
    @staticmethod
    def _clean_https_clone_url(url:str) -> str:
        parsed = urlparse(url.strip())
        if parsed.scheme in ("http","https") and parsed.netloc:
            netloc = parsed.netloc.split("@")[-1]
            return urlunparse((parsed.scheme, netloc,parsed.path,parsed.params,parsed.query, parsed.fragment))
        return url.strip()
    
    def set_remote(self,clone_url:str,remote_name:str = "origin")->str:
        clean_url = self._clean_https_clone_url(clone_url)
        remotes_result = self._run(["remote"],check=False)
        existing_remotes = remotes_result.stdout.splitlines() if remotes_result.returncode == 0 else []
        
        if remote_name in existing_remotes:
            self._run(["remote","set-url",remote_name,clean_url])
        else:
            self._run(["remote","add",remote_name,clean_url])
        self.assert_clean_remote(remote_name)
        return clean_url
    
    def remote_url(self, remote_name: str = "origin") -> Optional[str]:
        """Reads back the remote URL from git config."""
        result = self._run(["remote", "get-url", remote_name], check=False)
        if result.returncode != 0:
            return None
        return result.stdout.strip()
         
    def assert_clean_remote(self, remote_name: str = "origin") -> None:
        """
        Fails hard if a secret or basic auth string ever finds its way into .git/config.
        """
        url = self.remote_url(remote_name)
        if not url:
            return
            
        # Detect any 'user:' or 'token@' pattern in URL netloc
        if "@" in url:
            raise WorkspaceGitError(f"CRITICAL SECURITY VIOLATION: Token detected in remote URL: {url}")
        
        # Also inspect raw .git/config file as double-check
        config_path = self.host_path / ".git" / "config"
        if config_path.exists():
            content = config_path.read_text(encoding="utf-8", errors="replace")
            if re.search(r"https?://[^/\s]+:[^/\s]+@", content):
                raise WorkspaceGitError("CRITICAL SECURITY VIOLATION: Auth pattern found inside .git/config file!")
            
    def _run_with_auth(
        self,
        args: List[str],
        token: str,
        *,
        cwd: Path | None = None,
        use_git_c: bool = True,
    ) -> subprocess.CompletedProcess:
        """Run a networked git command with ephemeral credentials.

        Token is never written into the remote URL or ``.git/config``.
        On Windows we use a Python askpass helper (cmd findstr was unreliable)
        and also set ``http.extraHeader`` for this process only.
        """
        askpass_dir: Path | None = None
        try:
            askpass_dir = Path(tempfile.mkdtemp(prefix="cloud-agent-git-"))
            script = askpass_dir / "askpass.py"
            script.write_text(_ASKPASS_PY, encoding="utf-8")

            if os.name == "nt":
                wrapper = askpass_dir / "askpass.cmd"
                wrapper.write_text(
                    "@echo off\r\n"
                    f'"{sys.executable}" "{script}" %*\r\n',
                    encoding="utf-8",
                )
                askpass_path = str(wrapper)
            else:
                wrapper = askpass_dir / "askpass.sh"
                wrapper.write_text(
                    "#!/bin/sh\n"
                    f'exec "{sys.executable}" "{script}" "$@"\n',
                    encoding="utf-8",
                )
                wrapper.chmod(wrapper.stat().st_mode | stat.S_IXUSR)
                askpass_path = str(wrapper)

            # Bearer header is the most reliable path on Windows (avoids GCM /
            # broken cmd askpass). Askpass remains as a fallback for prompts.
            basic = base64.b64encode(
                f"x-access-token:{token}".encode("utf-8")
            ).decode("ascii")

            auth_env = {
                "GIT_ASKPASS": askpass_path,
                "GIT_USERNAME": "x-access-token",
                "GIT_PASSWORD": token,
                "GIT_TERMINAL_PROMPT": "0",
                "GCM_INTERACTIVE": "never",
                "GIT_CONFIG_COUNT": "2",
                "GIT_CONFIG_KEY_0": "credential.helper",
                "GIT_CONFIG_VALUE_0": "",
                "GIT_CONFIG_KEY_1": "http.extraHeader",
                "GIT_CONFIG_VALUE_1": f"Authorization: Basic {basic}",
            }
            result = self._run(
                args,
                env=auth_env,
                check=True,
                cwd=cwd,
                use_git_c=use_git_c,
            )
            if self.is_git_repo():
                self.assert_clean_remote()
            return result
        finally:
            if askpass_dir is not None:
                shutil.rmtree(askpass_dir, ignore_errors=True)

    def push(self, token: str, remote_name: str = "origin", branch: str = "main") -> None:
        self._run_with_auth(["push", "-u", remote_name, branch], token=token)

    def fetch(self, token: str, remote_name: str = "origin") -> None:
        self._run_with_auth(["fetch", remote_name], token=token)

    def pull(self, token: str, remote_name: str = "origin", branch: str = "main") -> None:
        self._run_with_auth(["pull", remote_name, branch], token=token)

    def clone(
        self,
        token: str,
        remote_url: str,
        branch: str | None = "main",
    ) -> None:
        """Clone into ``self.host_path``. Path must be missing or empty."""
        clean_url = self._clean_https_clone_url(remote_url)
        parent = self.host_path.parent
        parent.mkdir(parents=True, exist_ok=True)

        if self.host_path.exists():
            if (self.host_path / ".git").exists():
                raise WorkspaceGitError(
                    f"Refusing to clone into existing git repo: {self.host_path}"
                )
            if any(self.host_path.iterdir()):
                raise WorkspaceGitError(
                    f"Refusing to clone into non-empty path: {self.host_path}"
                )
            self.host_path.rmdir()

        args = ["clone"]
        if branch:
            args.extend(["--branch", branch, "--single-branch"])
        args.extend([clean_url, str(self.host_path)])
        self._run_with_auth(args, token, cwd=parent, use_git_c=False)
        # Defense in depth: remote must stay credential-free.
        self.set_remote(clean_url)