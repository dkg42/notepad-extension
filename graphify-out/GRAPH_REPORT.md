# Graph Report - src/components  (2026-05-03)

## Corpus Check
- Corpus is ~46,028 words - fits in a single context window. You may not need a graph.

## Summary
- 410 nodes · 341 edges · 30 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.84)
- Token cost: 55,500 input · 12,000 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Chat & Pipeline Navigation|Chat & Pipeline Navigation]]
- [[_COMMUNITY_Sidebar Capture & Chat|Sidebar Capture & Chat]]
- [[_COMMUNITY_Core Data & Auth Utilities|Core Data & Auth Utilities]]
- [[_COMMUNITY_Content Import & Sources|Content Import & Sources]]
- [[_COMMUNITY_Folder & Tag Filtering|Folder & Tag Filtering]]
- [[_COMMUNITY_Account Page Internals|Account Page Internals]]
- [[_COMMUNITY_Account & Auth UI|Account & Auth UI]]
- [[_COMMUNITY_Clipboard & Snippet List|Clipboard & Snippet List]]
- [[_COMMUNITY_Analytics & Bulk Actions|Analytics & Bulk Actions]]
- [[_COMMUNITY_Settings & Import Dialogs|Settings & Import Dialogs]]
- [[_COMMUNITY_Folder Navigation UI|Folder Navigation UI]]
- [[_COMMUNITY_Prompt Hub Internals|Prompt Hub Internals]]
- [[_COMMUNITY_Media & Artifacts Pages|Media & Artifacts Pages]]
- [[_COMMUNITY_Analytics Page Internals|Analytics Page Internals]]
- [[_COMMUNITY_Audio Player|Audio Player]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 114|Community 114]]
- [[_COMMUNITY_Community 115|Community 115]]
- [[_COMMUNITY_Community 116|Community 116]]
- [[_COMMUNITY_Community 117|Community 117]]
- [[_COMMUNITY_Community 118|Community 118]]
- [[_COMMUNITY_Community 119|Community 119]]

## God Nodes (most connected - your core abstractions)
1. `PromptsTable Component` - 10 edges
2. `useAllSourcesPage Hook` - 6 edges
3. `NavigationContext` - 6 edges
4. `useChatHistoryView Hook` - 6 edges
5. `HomeView Component` - 6 edges
6. `FolderManager Component` - 5 edges
7. `useAllArtifactsPage Hook` - 5 edges
8. `SnippetsContext` - 5 edges
9. `SearchBar Component` - 5 edges
10. `PromptsPage Component` - 5 edges

## Surprising Connections (you probably didn't know these)
- `handleSignIn()` --calls--> `getFriendlyAuthError()`  [INFERRED]
  AccountSwitcher/AccountSwitcher.tsx → dashboard/AccountPage/AccountPage.tsx
- `TagFilter Component` --references--> `TagFilter HTML Template`  [INFERRED]
  src/components/TagFilter/TagFilter.tsx → src/components/TagFilter/TagFilter.html
- `useRssFeedForm Hook` --semantically_similar_to--> `Storage Service`  [INFERRED] [semantically similar]
  src/components/dashboard/RssFeedForm/useRssFeedForm.ts → src/services/storage-service.ts
- `AccountSwitcher Component` --semantically_similar_to--> `AuthButton Component`  [INFERRED] [semantically similar]
  src/components/AccountSwitcher/AccountSwitcher.tsx → src/components/AuthButton/AuthButton.tsx
- `getFriendlyAuthError (AccountPage)` --semantically_similar_to--> `getFriendlyAuthError (AccountSwitcher)`  [INFERRED] [semantically similar]
  src/components/dashboard/AccountPage/AccountPage.tsx → src/components/AccountSwitcher/AccountSwitcher.tsx

## Hyperedges (group relationships)
- **Sign-in Flow: AuthButton, AccountSwitcher, AccountPage all trigger authService.signIn** — authbutton_authbutton, accountswitcher_accountswitcher, accountpage_accountpage [INFERRED 0.95]
- **Folder CRUD Pattern: FolderManager + useFolderManager + FolderFilterDropdown collaborate on folder data** — foldermanager_foldermanager, usefoldermanager_usefoldermanager, folderfilter_folderfilter [INFERRED 0.85]
- **Artifact Dashboard Pages: AllArtifactsPage and AllAudioPage both fetch FETCH_ALL_ARTIFACTS via background message** — useallartifactspage_fetchdata, useallaudiopage_fetchdata, allartifactspage_allartifactspage [EXTRACTED 1.00]
- **Bulk Source Import Flow** — usebrowsertabsform_hook, usecsvuploadform_hook, bulkimportprogress_component, useallsourcespage_hook [INFERRED 0.85]
- **Chat History View and Detail Flow** — chathistorypage_component, usechathistorypage_hook, chathistorydetailpage_component, usechathistorydetailpage_hook, navigationcontext_context [EXTRACTED 1.00]
- **Snippet Data Consumer Components** — analyticspage_component, useanalyticspage_hook, usecommandpalette_hook, snippetscontext_context [INFERRED 0.85]
- **Notebook Management Flow (List, Detail, Import)** — notebookspage_notebookspage, notebookdetailpage_notebookdetailpage, importsourcesmodal_importsourcesmodal [INFERRED 0.95]
- **Folder CRUD Pattern (Explorer, Card, Tree, Move)** — folderexplorer_folderexplorer, foldercard_foldercard, foldertree_foldertree, movefolderdialog_movefolderdialog [EXTRACTED 1.00]
- **Domain Router Import Flow (Import Modal, Router Settings, Import Hook)** — importsourcesmodal_importsourcesmodal, domainroutersettings_domainroutersettings, useimportsources_useimportsources [EXTRACTED 1.00]
- **Pipeline CRUD Flow** — usepipelinespage_hook, pipelinebuilder_component, pipelinespage_component [EXTRACTED 1.00]
- **Prompts Table Data Flow** — snippetscontext_context, usepromptstable_hook, promptstable_component, pagination_component [EXTRACTED 1.00]
- **Podcast Episode Management Flow** — usepodcastspage_hook, podcastspage_component, podcastdetailpage_component, usepodcastdetailpage_hook [EXTRACTED 1.00]
- **Sidebar View Navigation Flow** — homeview_component, sidebarheader_component, prompthubview_component, chathistoryview_component, screenshotview_component, tabmanagerview_component, snippetsview_component [INFERRED 0.85]
- **Tag Management Pipeline** — tagmanager_component, usetagmanager_hook, tagcard_component, snippetscontext_context, tagmeta_type [INFERRED 0.85]
- **Tab Group Persistence Flow** — tabmanagerview_component, usetabmanagerview_hook, tabgroupsstorage_service, tabgroup_type, stashedtab_type [EXTRACTED 1.00]

## Communities

### Community 0 - "Chat & Pipeline Navigation"
Cohesion: 0.09
Nodes (27): ChatHistoryDetailPage Component, ChatHistoryPage Component, DomainRouterSettings Component, NavigationContext, Notebook Annotation Service, PipelineBuilder Component, PipelinesPage Component, Pipeline Templates (+19 more)

### Community 1 - "Sidebar Capture & Chat"
Cohesion: 0.11
Nodes (25): CaptureMode Type, CaptureRecord Type, ChatHistoryView Component, ChatPlatform Type, ClipboardEntry Type, ConversationFull Type, ConversationMeta Type, CrawlConfig Type (+17 more)

### Community 2 - "Core Data & Auth Utilities"
Cohesion: 0.12
Nodes (23): Auth Service, FavoriteButton Component, filterSnippets Utility, Folder Utils, NotebookAnnotation Type, Pagination Component, PromptHubView Component, PromptsPage Component (+15 more)

### Community 3 - "Content Import & Sources"
Cohesion: 0.18
Nodes (13): AllSourcesPage Component, BrowserTabsForm Component, csv-parser Utilities, CsvUploadForm Component, notebookSyncService, SearchBar Component, sourceExportStrategies Registry, AggregatedSource Type (+5 more)

### Community 4 - "Folder & Tag Filtering"
Cohesion: 0.24
Nodes (12): FolderFilterDropdown Component, FolderManager Component, TagFilter HTML Template, TagFilter Component, useFolderFilterDropdown handleToggle, useFolderFilterDropdown Hook, useFolderManager handleCreate, useFolderManager handleCreateSubfolder (+4 more)

### Community 5 - "Account Page Internals"
Cohesion: 0.2
Nodes (3): getFriendlyAuthError(), handleSignIn(), handleSignIn()

### Community 6 - "Account & Auth UI"
Cohesion: 0.2
Nodes (11): AccountPage Dashboard Component, getFriendlyAuthError (AccountPage), AccountPage handleSignIn, AccountPage handleSignOut, AccountSwitcher Component, getFriendlyAuthError (AccountSwitcher), getInitials (AccountSwitcher), AccountSwitcher handleSignIn (+3 more)

### Community 7 - "Clipboard & Snippet List"
Cohesion: 0.2
Nodes (10): ClipboardEntryItem Component, ClipboardTab Component, SnippetItem Component, SnippetList Component, useClipboardTab handleSaveAsSnippet, useClipboardTab Hook, useSnippetItem commitTag, parseHostname (SnippetItem) (+2 more)

### Community 8 - "Analytics & Bulk Actions"
Cohesion: 0.24
Nodes (10): AnalyticsPage Component, BulkActionsBar Component, CommandPalette Component, StatChart Component, DashboardView Type, Folder Type, Snippet Type, useAnalyticsPage Hook (+2 more)

### Community 9 - "Settings & Import Dialogs"
Cohesion: 0.25
Nodes (9): DomainRouterSettings Component, DriveConflictDialog Component, ImportSourcesModal Component, NotebookDetailPage Component, NotebooksPage Component, useDomainRouterSettings Hook, useImportSources Hook, useNotebookDetailPage Hook (+1 more)

### Community 10 - "Folder Navigation UI"
Cohesion: 0.25
Nodes (9): DashboardHome Component, FolderCard Component, FolderExplorer Component, FolderTree Component, FolderTreeNode Internal Component, MoveFolderDialog Component, useDashboardHome Hook, useFolderExplorer Hook (+1 more)

### Community 11 - "Prompt Hub Internals"
Cohesion: 0.29
Nodes (2): tagColor(), TagPill()

### Community 12 - "Media & Artifacts Pages"
Cohesion: 0.32
Nodes (8): AllArtifactsPage Dashboard Component, AllAudioPage Dashboard Component, useAllArtifactsPage fetchData, useAllArtifactsPage handleExportCsv, useAllArtifactsPage handleExportJson, useAllArtifactsPage Hook, useAllAudioPage fetchData, useAllAudioPage Hook

### Community 14 - "Analytics Page Internals"
Cohesion: 0.33
Nodes (2): AnalyticsPage(), useAnalyticsPage()

### Community 19 - "Audio Player"
Cohesion: 0.4
Nodes (2): AudioPlayer(), useAudioPlayer()

### Community 20 - "Community 20"
Cohesion: 0.5
Nodes (2): SnippetList(), buildFolderMap()

### Community 22 - "Community 22"
Cohesion: 0.5
Nodes (2): PromptsTable(), usePromptsTable()

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (2): handleKeyDown(), handleRename()

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (2): handleKeyDown(), handleRename()

### Community 90 - "Community 90"
Cohesion: 1.0
Nodes (2): AudioPlayer Component, useAudioPlayer Hook

### Community 91 - "Community 91"
Cohesion: 1.0
Nodes (2): BulkImportProgress Component, BulkImportProgress Type

### Community 92 - "Community 92"
Cohesion: 1.0
Nodes (2): AssignCollectionModal Component, NotebookCollection Type

### Community 93 - "Community 93"
Cohesion: 1.0
Nodes (2): ExportHistoryPage Component, useExportHistoryPage Hook

### Community 94 - "Community 94"
Cohesion: 1.0
Nodes (2): Accordion UI Component, Radix UI Accordion Primitive

### Community 114 - "Community 114"
Cohesion: 1.0
Nodes (1): ColorPicker Component

### Community 115 - "Community 115"
Cohesion: 1.0
Nodes (1): FavoriteButton Component

### Community 116 - "Community 116"
Cohesion: 1.0
Nodes (1): KeyboardShortcutsPanel Component

### Community 117 - "Community 117"
Cohesion: 1.0
Nodes (1): ImportTab Type

### Community 118 - "Community 118"
Cohesion: 1.0
Nodes (1): FolderViewMode Type

### Community 119 - "Community 119"
Cohesion: 1.0
Nodes (1): UNCOLLECTED_FILTER_ID Sentinel

## Ambiguous Edges - Review These
- `useWebCrawlerForm Hook` → `tabGroupsStorage Service`  [AMBIGUOUS]
  src/components/dashboard/WebCrawlerForm/useWebCrawlerForm.ts · relation: calls

## Knowledge Gaps
- **60 isolated node(s):** `getInitials (AccountSwitcher)`, `AuthButton handleSignIn`, `useClipboardTab handleSaveAsSnippet`, `useSnippetItem commitTag`, `buildFolderMap Utility` (+55 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Prompt Hub Internals`** (8 nodes): `countDescendants()`, `formatAge()`, `getSnippetTitle()`, `handleCopy()`, `handleSave()`, `tagColor()`, `TagPill()`, `PromptHubView.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Analytics Page Internals`** (6 nodes): `AnalyticsPage()`, `extractHostname()`, `getMonthLabel()`, `useAnalyticsPage()`, `AnalyticsPage.tsx`, `useAnalyticsPage.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Audio Player`** (5 nodes): `AudioPlayer()`, `formatTime()`, `useAudioPlayer()`, `AudioPlayer.tsx`, `useAudioPlayer.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (4 nodes): `SnippetList()`, `SnippetList.tsx`, `buildFolderMap()`, `useSnippetList.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (4 nodes): `PromptsTable.tsx`, `usePromptsTable.ts`, `PromptsTable()`, `usePromptsTable()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (3 nodes): `TagCard.tsx`, `handleKeyDown()`, `handleRename()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (3 nodes): `FolderCard.tsx`, `handleKeyDown()`, `handleRename()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 90`** (2 nodes): `AudioPlayer Component`, `useAudioPlayer Hook`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 91`** (2 nodes): `BulkImportProgress Component`, `BulkImportProgress Type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 92`** (2 nodes): `AssignCollectionModal Component`, `NotebookCollection Type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 93`** (2 nodes): `ExportHistoryPage Component`, `useExportHistoryPage Hook`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 94`** (2 nodes): `Accordion UI Component`, `Radix UI Accordion Primitive`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 114`** (1 nodes): `ColorPicker Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 115`** (1 nodes): `FavoriteButton Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 116`** (1 nodes): `KeyboardShortcutsPanel Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 117`** (1 nodes): `ImportTab Type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 118`** (1 nodes): `FolderViewMode Type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 119`** (1 nodes): `UNCOLLECTED_FILTER_ID Sentinel`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `useWebCrawlerForm Hook` and `tabGroupsStorage Service`?**
  _Edge tagged AMBIGUOUS (relation: calls) - confidence is low._
- **Why does `PromptHubView Component` connect `Core Data & Auth Utilities` to `Sidebar Capture & Chat`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `HomeView Component` connect `Sidebar Capture & Chat` to `Core Data & Auth Utilities`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `SearchBar Component` connect `Content Import & Sources` to `Chat & Pipeline Navigation`, `Core Data & Auth Utilities`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `useChatHistoryView Hook` (e.g. with `ChatHistoryView Component` and `useWebCrawlerForm Hook`) actually correct?**
  _`useChatHistoryView Hook` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `HomeView Component` (e.g. with `PromptHubView Component` and `SnippetsView Component`) actually correct?**
  _`HomeView Component` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `getInitials (AccountSwitcher)`, `AuthButton handleSignIn`, `useClipboardTab handleSaveAsSnippet` to the rest of the system?**
  _60 weakly-connected nodes found - possible documentation gaps or missing edges._