from pydantic import BaseModel, Field


class GitHubAuthorizeResponse(BaseModel):
    url: str


class GitHubStatusResponse(BaseModel):
    connected: bool
    login: str | None = None
    avatarUrl: str | None = None


class GitHubRepoItem(BaseModel):
    id: int
    name: str
    full_name: str
    private: bool
    html_url: str
    clone_url: str
    default_branch: str
    description: str | None = None
    owner_login: str
    owner_avatar_url: str | None = None
    updated_at: str | None = None


class GitHubReposResponse(BaseModel):
    repos: list[GitHubRepoItem]


class ImportGithubWorkspaceRequest(BaseModel):
    owner: str = Field(min_length=1)
    name: str = Field(min_length=1)
    full_name: str = Field(min_length=3)
    default_branch: str = Field(min_length=1)
    clone_url: str = Field(min_length=1)
    html_url: str = Field(min_length=1)
    private: bool = False
