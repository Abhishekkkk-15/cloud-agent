from pathlib import Path
from typing import Optional,Dict,List
import os
import subprocess
from urllib.parse import urlparse, urlunparse
import re
import tempfile
import stat
class WorkspaceGitError(Exception):
    pass

class WorkspaceGitService:
    def __init__(self,host_path:Path) -> None:
        self.host_path = host_path
        
    def _run(self,args:list[str],env:Optional[Dict[str,str]] = None,check:bool=True):
        if not self.host_path.exists():
            raise WorkspaceGitError(f"Directory does not exist : {self.host_path}")
        # Ensure base environment is passed along with custom variables
        run_env = {**os.environ}
        if env:
            run_env.update(env)
            
        cmd = ["git","-C",str(self.host_path),"-c",f"core.hooksPath={os.devnull}"] + args
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=run_env,
                check=False
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
            
    def _run_with_auth(self,args:List[str],token:str) -> subprocess.CompletedProcess:
        is_windows = os.name == "nt"
        askpass_file = None
        
        try:
            if is_windows:
                fd,path_str = tempfile.mkstemp(prefix="git-askpass-",suffix=".cmd")
                os.close(fd)
                askpass_file = Path(path_str)
                askpass_file.write_text(
                    "@echo off\n"
                    "echo %* | findstr /I \"Username\" >nul && echo %GIT_USERNAME% && exit /b 0\n"
                    "echo %* | findstr /I \"Password\" >nul && echo %GIT_PASSWORD% && exit /b 0\n"
                    "echo.\n",
                    encoding="utf-8",
                )
            else:
                fd,path_str = tempfile.mkstemp(prefix="git-askpass-",suffix=".sh")
                os.close(fd)
                askpass_file = Path(path_str)
                askpass_file.write_text(
                    "#!/bin/sh\n"
                    'case "$1" in\n'
                    '  *Username*) echo "${GIT_USERNAME}" ;;\n'
                    '  *Password*) echo "${GIT_PASSWORD}" ;;\n'
                    "esac\n",
                    encoding="utf-8",
                )
                askpass_file.chmod(stat.S_IRWXU)
            auth_env = {
                "GIT_ASKPASS": str(askpass_file),
                "GIT_USERNAME": "x-access-token",
                "GIT_PASSWORD": token,
                "GIT_TERMINAL_PROMPT": "0",
                # Force-disable credential helpers so git doesn't save the password to disk/store
                "GIT_CONFIG_COUNT": "1",
                "GIT_CONFIG_KEY_0": "credential.helper",
                "GIT_CONFIG_VALUE_0": "",
            }    
            result = self._run(args,env=auth_env,check=True)
            self.assert_clean_remote()
            return result
        finally:
            if askpass_file and askpass_file.exists():
                askpass_file.unlink(missing_ok=True)
    def push(self, token: str, remote_name: str = "origin", branch: str = "main") -> None:
        self._run_with_auth(["push", "-u", remote_name, branch], token=token)

    def fetch(self, token: str, remote_name: str = "origin") -> None:
        self._run_with_auth(["fetch", remote_name], token=token)

    def pull(self, token: str, remote_name: str = "origin", branch: str = "main") -> None:
        self._run_with_auth(["pull", remote_name, branch], token=token)