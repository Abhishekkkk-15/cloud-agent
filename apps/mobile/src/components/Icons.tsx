import React from 'react';
import * as Lucide from 'lucide-react-native';

export interface IconProps {
  size?: number;
  color?: string;
  style?: any;
}

function wrapIcon(Comp: any): React.FC<IconProps> {
  return (props: IconProps) => React.createElement(Comp, props);
}

export const Activity = wrapIcon(Lucide.Activity);
export const ShieldAlert = wrapIcon(Lucide.ShieldAlert);
export const Bot = wrapIcon(Lucide.Bot);
export const Layers = wrapIcon(Lucide.Layers);
export const ArrowLeft = wrapIcon(Lucide.ArrowLeft);
export const MoreVertical = wrapIcon(Lucide.MoreVertical);
export const Server = wrapIcon(Lucide.Server);
export const ShieldCheck = wrapIcon(Lucide.ShieldCheck);
export const Lock = wrapIcon(Lucide.Lock);
export const Cpu = wrapIcon(Lucide.Cpu);
export const HardDrive = wrapIcon(Lucide.HardDrive);
export const ArrowUp = wrapIcon(Lucide.ArrowUp);
export const ArrowDown = wrapIcon(Lucide.ArrowDown);
export const ArrowRight = wrapIcon(Lucide.ArrowRight);
export const Terminal = wrapIcon(Lucide.Terminal);
export const Code2 = wrapIcon(Lucide.Code2);
export const FileCode = wrapIcon(Lucide.FileCode);
export const Radio = wrapIcon(Lucide.Radio);
export const RefreshCw = wrapIcon(Lucide.RefreshCw);
export const Zap = wrapIcon(Lucide.Zap);
export const Power = wrapIcon(Lucide.Power);
export const ChevronRight = wrapIcon(Lucide.ChevronRight);
export const ChevronDown = wrapIcon(Lucide.ChevronDown);
export const ChevronUp = wrapIcon(Lucide.ChevronUp);
export const AlertTriangle = wrapIcon(Lucide.AlertTriangle);
export const Clock = wrapIcon(Lucide.Clock);
export const Shield = wrapIcon(Lucide.Shield);
export const Copy = wrapIcon(Lucide.Copy);
export const Check = wrapIcon(Lucide.Check);
export const X = wrapIcon(Lucide.X);
export const Database = wrapIcon(Lucide.Database);
export const CheckCircle2 = wrapIcon(Lucide.CheckCircle2);
export const XCircle = wrapIcon(Lucide.XCircle);
export const GitCommit = wrapIcon(Lucide.GitCommit);
export const GitBranch = wrapIcon(Lucide.GitBranch);
export const GitMerge = wrapIcon(Lucide.GitMerge);
export const Link = wrapIcon(Lucide.Link);
export const FileText = wrapIcon(Lucide.FileText);
export const Paperclip = wrapIcon(Lucide.Paperclip);
export const Mic = wrapIcon(Lucide.Mic);
export const Search = wrapIcon(Lucide.Search);
export const Sparkles = wrapIcon(Lucide.Sparkles);
export const ArrowUpDown = wrapIcon(Lucide.ArrowUpDown);
export const Play = wrapIcon(Lucide.Play);
export const User = wrapIcon(Lucide.User);
export const Send = wrapIcon(Lucide.Send);
export const GitPullRequest = wrapIcon(Lucide.GitPullRequest);
export const Folder = wrapIcon(Lucide.Folder);
export const FolderGit2 = wrapIcon(Lucide.FolderGit2);
export const Home = wrapIcon(Lucide.Home);
export const Inbox = wrapIcon(Lucide.Inbox);
export const Compass = wrapIcon(Lucide.Compass);
export const Wrench = wrapIcon(Lucide.Wrench);
export const Share2 = wrapIcon(Lucide.Share2);
export const GitFork = wrapIcon(Lucide.GitFork);
export const Brain = wrapIcon(Lucide.Brain);
export const SlidersHorizontal = wrapIcon(Lucide.SlidersHorizontal);
export const Flame = wrapIcon(Lucide.Flame);
export const Command = wrapIcon(Lucide.Command);
export const Plus = wrapIcon(Lucide.Plus);
export const ChevronLeft = wrapIcon(Lucide.ChevronLeft);
export const Menu = wrapIcon(Lucide.Menu);
export const MessageSquare = wrapIcon(Lucide.MessageSquare);
export const LogOut = wrapIcon(Lucide.LogOut);
