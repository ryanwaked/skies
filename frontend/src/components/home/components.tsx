/* Copyright 2026 Marimo. All rights reserved. */

import { CaretDownIcon } from "@radix-ui/react-icons";
import {
  ActivityIcon,
  ArrowUpRightIcon,
  BarChart2Icon,
  BookMarkedIcon,
  BookOpenIcon,
  CloudIcon,
  DatabaseIcon,
  FileIcon,
  FileTextIcon,
  GraduationCapIcon,
  GridIcon,
  LayoutIcon,
  MessagesSquareIcon,
  OrbitIcon,
  PackageIcon,
} from "lucide-react";
import type React from "react";
import { MarkdownIcon } from "@/components/editor/cell/code/icons";
import { GitHubIcon } from "@/components/icons/github";
import { YouTubeIcon } from "@/components/icons/youtube";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Constants } from "@/core/constants";
import { useRequestClient } from "@/core/network/requests";
import type { TutorialId } from "@/core/network/types";
import { openNotebook } from "@/utils/links";
import { Objects } from "@/utils/objects";

const TUTORIALS: Record<
  TutorialId,
  [string, React.FC<React.SVGProps<SVGSVGElement>>, string]
> = {
  intro: ["Introduction", BookOpenIcon, "Get started with marimo basics"],
  dataflow: [
    "Dataflow",
    ActivityIcon,
    "Learn how cells interact with each other",
  ],
  ui: ["UI Elements", LayoutIcon, "Create interactive UI components"],
  markdown: [
    "Markdown",
    FileTextIcon,
    "Format text with parameterized markdown",
  ],
  plots: ["Plots", BarChart2Icon, "Create interactive visualizations"],
  sql: ["SQL", DatabaseIcon, "Query databases directly in marimo"],
  layout: ["Layout", GridIcon, "Customize the layout of your cells' output"],
  fileformat: [
    "File format",
    FileIcon,
    "Understand marimo's pure-Python file format",
  ],
  "external-dependencies": [
    "External dependencies",
    PackageIcon,
    "Declare dependencies with Python script metadata",
  ],
  "for-jupyter-users": [
    "For Jupyter users",
    OrbitIcon,
    "Transiting from Jupyter to marimo",
  ],
  "markdown-format": [
    "Markdown format",
    MarkdownIcon,
    "Using marimo to edit markdown files",
  ],
};

export const OpenTutorialDropDown: React.FC = () => {
  const { openTutorial } = useRequestClient();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild={true}>
        <Button data-testid="open-tutorial-button" size="xs" variant="outline">
          <GraduationCapIcon className="w-4 h-4 mr-2" />
          Tutorials
          <CaretDownIcon className="w-3 h-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="print:hidden">
        {Objects.entries(TUTORIALS).map(
          ([tutorialId, [label, Icon, description]]) => (
            <DropdownMenuItem
              key={tutorialId}
              onSelect={async () => {
                const file = await openTutorial({ tutorialId });
                if (!file) {
                  return;
                }
                openNotebook(file.path);
              }}
            >
              <Icon
                strokeWidth={1.5}
                className="w-4 h-4 mr-3 self-start mt-1.5 text-muted-foreground"
              />
              <div className="flex items-center">
                <div className="flex flex-col">
                  <span>{label}</span>
                  <span className="text-xs text-muted-foreground pr-1">
                    {description}
                  </span>
                </div>
              </div>
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const RESOURCES = [
  {
    title: "Documentation",
    description: "Official marimo documentation and API reference",
    icon: BookMarkedIcon,
    url: Constants.docsPage,
  },
  {
    title: "GitHub",
    description: "View source code, report issues, or contribute",
    icon: GitHubIcon,
    url: Constants.githubPage,
  },
  {
    title: "Community",
    description: "Join the marimo Discord community",
    icon: MessagesSquareIcon,
    url: Constants.discordLink,
  },
  {
    title: "molab",
    description: "Run marimo notebooks in the cloud",
    icon: CloudIcon,
    url: Constants.molab,
  },
  {
    title: "YouTube",
    description: "Watch tutorials and demos",
    icon: YouTubeIcon,
    url: Constants.youtube,
  },
  {
    title: "Changelog",
    description: "See what's new in marimo",
    icon: FileTextIcon,
    url: Constants.releasesPage,
  },
];

/** Hostname shown as the card's mono sub-line (the site's linkcard voice). */
function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const ResourceLinks: React.FC = () => {
  return (
    <div className="flex flex-col gap-3">
      <Header>resources</Header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {RESOURCES.map((resource) => (
          <a
            key={resource.title}
            href={resource.url}
            target="_blank"
            className="skies-linkcard"
            rel="noreferrer"
          >
            <span className="skies-linkcard__ic">
              <resource.icon strokeWidth={1.5} />
            </span>
            <span className="skies-linkcard__meta">
              <span className="skies-linkcard__label">{resource.title}</span>
              <span className="skies-linkcard__sub" title={resource.description}>
                {hostOf(resource.url)}
              </span>
            </span>
            <ArrowUpRightIcon
              className="skies-linkcard__arrow"
              size={15}
              strokeWidth={1.5}
            />
          </a>
        ))}
      </div>
    </div>
  );
};

/**
 * Section head in the site's doc-label voice: a mono kicker with the
 * copper slashes, a trailing hairline rule, and an optional control
 * cluster on the right.
 */
export const Header: React.FC<{
  control?: React.ReactNode;
  children: React.ReactNode;
}> = ({ control, children }) => {
  return (
    <div className="skies-section-head select-none">
      <h2 className="skies-kicker">{children}</h2>
      <div className="skies-section-head__rule" />
      {control && <div className="skies-section-head__control">{control}</div>}
    </div>
  );
};
