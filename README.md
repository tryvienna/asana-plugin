# Asana

Asana project management integration for Vienna — tasks, projects, and workspaces.

## Features

- **Feed canvas** — Home feed card showing Asana tasks with project, completion status, due date, and section filters. Select tasks and launch agent workstreams directly from the feed.
- **Nav sidebar** — Browse tasks with grouping by project, section, assignee, or due date with the Asana logo icon.
- **Tasks** — Create, search, update, delete, comment, and track subtasks
- **Filtering** — By project, section, assignee, completion status, and due date
- **Projects & Sections** — Browse projects, view sections, move tasks between sections
- **Mutations** — Update name, assignee, due dates, notes, completion, tags, and sections

## Setup

1. Go to [Asana Developer Console](https://app.asana.com/0/developer-console) and click **Create new token**
2. Give it a description (e.g. "Vienna") and click **Create token**
3. Copy the Personal Access Token
4. Open the Asana settings drawer in Vienna's sidebar
5. Paste the token into the **API Token** field

Once configured, the feed card and nav sidebar will show your tasks automatically. Select "My tasks" to see all tasks assigned to you across workspaces, or pick a specific project.

> **Note:** The workspace-wide search API (`asanaSearchTasks`) requires an Asana Premium plan. On free plans, "My tasks" uses the assignee query which shows tasks assigned to you.
