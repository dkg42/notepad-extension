# Graph Report - .  (2026-05-11)

## Corpus Check
- Large corpus: 235 files · ~119,564 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 1162 nodes · 1407 edges · 91 communities detected
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 193 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Dashboard Pages & Components|Dashboard Pages & Components]]
- [[_COMMUNITY_Core Services Layer|Core Services Layer]]
- [[_COMMUNITY_Google Drive IO API|Google Drive I/O API]]
- [[_COMMUNITY_Dashboard UI Views|Dashboard UI Views]]
- [[_COMMUNITY_Background Message Handlers|Background Message Handlers]]
- [[_COMMUNITY_Site Adapter Registry|Site Adapter Registry]]
- [[_COMMUNITY_Google Session & Notebook Sync|Google Session & Notebook Sync]]
- [[_COMMUNITY_Chat Adapter Interface|Chat Adapter Interface]]
- [[_COMMUNITY_Tag & Snippet Operations|Tag & Snippet Operations]]
- [[_COMMUNITY_NotebookLM Automation|NotebookLM Automation]]
- [[_COMMUNITY_Background Shared Utilities|Background Shared Utilities]]
- [[_COMMUNITY_Analytics & Usage Tracking|Analytics & Usage Tracking]]
- [[_COMMUNITY_Drive Conflict Resolution|Drive Conflict Resolution]]
- [[_COMMUNITY_Screenshot Annotation|Screenshot Annotation]]
- [[_COMMUNITY_Pipeline Automation|Pipeline Automation]]
- [[_COMMUNITY_Auth UI & Google Sign-In|Auth UI & Google Sign-In]]
- [[_COMMUNITY_Source Export (PDFDoc)|Source Export (PDF/Doc)]]
- [[_COMMUNITY_Chat History Display|Chat History Display]]
- [[_COMMUNITY_Screen Capture Pipeline|Screen Capture Pipeline]]
- [[_COMMUNITY_RSS & Web Import|RSS & Web Import]]
- [[_COMMUNITY_Snippet Display Utils|Snippet Display Utils]]
- [[_COMMUNITY_JWT & Crypto Utilities|JWT & Crypto Utilities]]
- [[_COMMUNITY_Clipboard & Blob Processing|Clipboard & Blob Processing]]
- [[_COMMUNITY_Storage Cache Layer|Storage Cache Layer]]
- [[_COMMUNITY_Image Compression Utils|Image Compression Utils]]
- [[_COMMUNITY_Source Google Doc Export|Source Google Doc Export]]
- [[_COMMUNITY_Chat Google Doc Export|Chat Google Doc Export]]
- [[_COMMUNITY_CSV Parser|CSV Parser]]
- [[_COMMUNITY_Content Script Orchestration|Content Script Orchestration]]
- [[_COMMUNITY_Chat History Handler|Chat History Handler]]
- [[_COMMUNITY_Perplexity Adapter|Perplexity Adapter]]
- [[_COMMUNITY_Copilot Adapter|Copilot Adapter]]
- [[_COMMUNITY_ChatGPT Adapter|ChatGPT Adapter]]
- [[_COMMUNITY_Claude Adapter|Claude Adapter]]
- [[_COMMUNITY_Gemini Adapter|Gemini Adapter]]
- [[_COMMUNITY_Audio Player Component|Audio Player Component]]
- [[_COMMUNITY_Navigation Context|Navigation Context]]
- [[_COMMUNITY_Plain Text Export|Plain Text Export]]
- [[_COMMUNITY_Source Markdown Export|Source Markdown Export]]
- [[_COMMUNITY_Markdown Export|Markdown Export]]
- [[_COMMUNITY_Source Plain Text Export|Source Plain Text Export]]
- [[_COMMUNITY_Drive Token Routing|Drive Token Routing]]
- [[_COMMUNITY_Source Delete Modal|Source Delete Modal]]
- [[_COMMUNITY_Subscription Guard|Subscription Guard]]
- [[_COMMUNITY_Snippet List Component|Snippet List Component]]
- [[_COMMUNITY_Dashboard App Shell|Dashboard App Shell]]
- [[_COMMUNITY_Drive Sync Helpers|Drive Sync Helpers]]
- [[_COMMUNITY_Clipboard Capture Helpers|Clipboard Capture Helpers]]
- [[_COMMUNITY_Source Export Modal|Source Export Modal]]
- [[_COMMUNITY_Tag Card Component|Tag Card Component]]
- [[_COMMUNITY_Folder Card Component|Folder Card Component]]
- [[_COMMUNITY_Source PDF Export|Source PDF Export]]
- [[_COMMUNITY_PDF Export|PDF Export]]
- [[_COMMUNITY_Notebook Annotation Drive Sync|Notebook Annotation Drive Sync]]
- [[_COMMUNITY_Pipeline Service Drive Sync|Pipeline Service Drive Sync]]
- [[_COMMUNITY_Storage Shared Sync|Storage Shared Sync]]
- [[_COMMUNITY_Folder & Snippet Filters|Folder & Snippet Filters]]
- [[_COMMUNITY_Theme Provider|Theme Provider]]
- [[_COMMUNITY_CSV Bulk Import|CSV Bulk Import]]
- [[_COMMUNITY_HTML Entrypoints|HTML Entrypoints]]
- [[_COMMUNITY_Extension Config|Extension Config]]
- [[_COMMUNITY_Tab Group Types|Tab Group Types]]
- [[_COMMUNITY_Accordion UI Primitives|Accordion UI Primitives]]
- [[_COMMUNITY_NotebookLM Source Export Feature|NotebookLM Source Export Feature]]
- [[_COMMUNITY_Drive Message Handler|Drive Message Handler]]
- [[_COMMUNITY_Import Message Handler|Import Message Handler]]
- [[_COMMUNITY_Audio Message Handler|Audio Message Handler]]
- [[_COMMUNITY_Message Type Guard|Message Type Guard]]
- [[_COMMUNITY_Chat History Handler|Chat History Handler]]
- [[_COMMUNITY_Screenshot Handler|Screenshot Handler]]
- [[_COMMUNITY_Pipeline Handler|Pipeline Handler]]
- [[_COMMUNITY_Source Handler|Source Handler]]
- [[_COMMUNITY_Export Record Type|Export Record Type]]
- [[_COMMUNITY_Vite Raw Module Type|Vite Raw Module Type]]
- [[_COMMUNITY_Notebook Collection Type|Notebook Collection Type]]
- [[_COMMUNITY_Podcast Episode Type|Podcast Episode Type]]
- [[_COMMUNITY_Bulk Import Progress Type|Bulk Import Progress Type]]
- [[_COMMUNITY_Bulk Import Job Type|Bulk Import Job Type]]
- [[_COMMUNITY_Snippets Hook|Snippets Hook]]
- [[_COMMUNITY_Snippets Provider|Snippets Provider]]
- [[_COMMUNITY_Navigation Hook|Navigation Hook]]
- [[_COMMUNITY_Navigation Provider|Navigation Provider]]
- [[_COMMUNITY_Subscription Hook|Subscription Hook]]
- [[_COMMUNITY_Subscription Provider|Subscription Provider]]
- [[_COMMUNITY_DOM Wait Utility|DOM Wait Utility]]
- [[_COMMUNITY_Folder Path Utility|Folder Path Utility]]
- [[_COMMUNITY_Folder Tree Items Utility|Folder Tree Items Utility]]
- [[_COMMUNITY_Studio Adapter Type Guard|Studio Adapter Type Guard]]
- [[_COMMUNITY_Tag Filter HTML|Tag Filter HTML]]
- [[_COMMUNITY_Screenshot Storage Service|Screenshot Storage Service]]
- [[_COMMUNITY_Tab Groups Storage Service|Tab Groups Storage Service]]

## God Nodes (most connected - your core abstractions)
1. `Background Service Worker` - 25 edges
2. `Types Index Barrel` - 23 edges
3. `Drive Sync Service` - 21 edges
4. `NotebookLMAdapter` - 20 edges
5. `NavigationContext / useNavigation` - 15 edges
6. `Storage Service` - 15 edges
7. `executeAuthenticatedRpc()` - 10 edges
8. `enqueue()` - 10 edges
9. `ChatSiteAdapter interface` - 10 edges
10. `HomeView` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Export Strategy Pattern (Architecture)` --conceptually_related_to--> `ExportStrategy Interface`  [EXTRACTED]
  CLAUDE.md → src/export/export-strategy.interface.ts
- `Export Strategy Pattern (Architecture)` --conceptually_related_to--> `Export Registry (Chat)`  [EXTRACTED]
  CLAUDE.md → src/export/export-registry.ts
- `Format Picker Panel (HTML)` --conceptually_related_to--> `Export Registry (Chat)`  [INFERRED]
  src/content/format-picker.html → src/export/export-registry.ts
- `Source Export Modal (HTML)` --conceptually_related_to--> `Source Export Registry (NotebookLM)`  [INFERRED]
  src/content/source-export-modal/source-export-modal.html → src/export/source-export-registry.ts
- `WXT Extension Config` --conceptually_related_to--> `Notebook Message Handler`  [INFERRED]
  wxt.config.ts → src/background/notebook-handler.ts

## Hyperedges (group relationships)
- **NotebookLM Data Cache Services** — source_count_cache_service, all_sources_cache_service, all_artifacts_cache_service, audio_cache_service [INFERRED 0.85]
- **Services That Tail-Call Drive Sync on Write** — chat_history_storage, notebook_annotation_service, domain_router_service, pipeline_service [EXTRACTED 1.00]
- **Pipeline Automation Subsystem** — pipeline_service, pipeline_executor, pipeline_templates [INFERRED 0.95]
- **Local-First Drive Sync Pipeline** — drive_sync_service, drive_write_queue, drive_io_service [EXTRACTED 1.00]
- **Drive Initialization Bootstrap Pipeline** — drive_init_service, drive_manifest_service, drive_cache_service, drive_write_queue [EXTRACTED 1.00]
- **Domain Storage Modules with Fire-and-Forget Drive Sync Pattern** — snippet_storage, folder_storage, tag_storage, settings_storage, export_history_storage, podcast_storage, sync_to_drive_fn [INFERRED 0.95]

## Communities

### Community 0 - "Dashboard Pages & Components"
Cohesion: 0.03
Nodes (96): ActionsStep, AggregatedArtifact, allArtifactsCacheService, AllArtifactsPage, AllAudioPage, allSourcesCacheService, AllSourcesPage, AssignCollectionModal (+88 more)

### Community 1 - "Core Services Layer"
Cohesion: 0.05
Nodes (80): All Artifacts Cache Service, All Sources Cache Service, Audio Cache Service, Auth Service, Auth Storage Service, AuthButton Component, Background Audio Handler, Background Chat History Handler (+72 more)

### Community 2 - "Google Drive I/O API"
Cohesion: 0.06
Nodes (57): authHeader(), buildMultipartBody(), createFile(), deleteFile(), findFileByName(), getDebugFolderId(), listAppDataFiles(), readFile() (+49 more)

### Community 3 - "Dashboard UI Views"
Cohesion: 0.05
Nodes (69): AccountPage, AccountSwitcher, AnalyticsPage, authService, ChatHistoryView, CollapsibleGroup (Sidebar sub-component), ComposeModal (PromptsPage sub-component), DashboardHome (+61 more)

### Community 4 - "Background Message Handlers"
Cohesion: 0.05
Nodes (55): handleAudioMessage, ensureSignedIn, isProUser, BulkActionsBar, handleChatHistoryMessage, useCommandPalette Hook, Dashboard Entrypoint Main, DashboardApp Root Component (+47 more)

### Community 5 - "Site Adapter Registry"
Cohesion: 0.06
Nodes (19): getAdapter(), isSourcePanelAdapter(), isStudioPanelAdapter(), setupChatSaveHandler(), addButton(), createButtonContainer(), setupHeaderButtons(), tryInject() (+11 more)

### Community 6 - "Google Session & Notebook Sync"
Cohesion: 0.1
Nodes (35): syncNotebooks(), ensureGoogleSession(), fetchGoogleAccounts(), findAuthuserIndex(), getSignedInGoogleAccountEmail(), invalidateSessionCache(), validateGoogleSession(), addUrlWithRetry() (+27 more)

### Community 7 - "Chat Adapter Interface"
Cohesion: 0.1
Nodes (32): ChatSiteAdapter interface, getAdapter, detectPlatform, extractConversationId, setupChatSaveHandler, ChatGPTAdapter, ClaudeAdapter, CopilotAdapter (+24 more)

### Community 8 - "Tag & Snippet Operations"
Cohesion: 0.07
Nodes (4): countDescendants(), filterSnippets(), getFolderDescendantIds(), getFolderSubtreeIds()

### Community 9 - "NotebookLM Automation"
Cohesion: 0.14
Nodes (1): NotebookLMAdapter

### Community 10 - "Background Shared Utilities"
Cohesion: 0.16
Nodes (11): handleAudioMessage(), handleNotebookMessage(), ensureSignedIn(), handleSourceMessage(), prefetchAndCacheAllData(), closeOffscreenDocument(), firebaseAuth(), handleAuthSessionMessage() (+3 more)

### Community 11 - "Analytics & Usage Tracking"
Cohesion: 0.12
Nodes (6): AnalyticsPage(), useAnalyticsPage(), useSnippets(), useColumnResize(), PromptsTable(), usePromptsTable()

### Community 12 - "Drive Conflict Resolution"
Cohesion: 0.23
Nodes (14): applyCachedDriveDataToLocal(), applyConflictDecision(), applyDriveData(), applyMergedData(), getLocalUpdatedAt(), initialize(), isProUser(), markDeviceInitialized() (+6 more)

### Community 13 - "Screenshot Annotation"
Cohesion: 0.16
Nodes (15): AnnotatePanel, Annotation, CaptureRecord, drawRoundRect, drawSingleAnnotation, EditorSettings, GeneralPanel, getCanvasCoords (+7 more)

### Community 14 - "Pipeline Automation"
Cohesion: 0.26
Nodes (8): runPipelineAnnotationTriggers(), runPipelineCheck(), deriveRunStatus(), evaluateAndRun(), evaluateTrigger(), executeAction(), getAnnotation(), notebooksInScope()

### Community 15 - "Auth UI & Google Sign-In"
Cohesion: 0.2
Nodes (3): getFriendlyAuthError(), handleSignIn(), handleSignIn()

### Community 16 - "Source Export (PDF/Doc)"
Cohesion: 0.33
Nodes (11): jsPDF Library, Source Delete Modal (HTML), Source Export Modal (HTML), Source Export Registry (NotebookLM), SourceExportStrategy Interface, SourceGoogleDocExportStrategy, SourceMarkdownExportStrategy, Source Panel Enhancer (HTML) (+3 more)

### Community 17 - "Chat History Display"
Cohesion: 0.2
Nodes (4): ChatHistoryView(), useChatHistoryView(), FeatureCard(), useUsageLimit()

### Community 18 - "Screen Capture Pipeline"
Cohesion: 0.38
Nodes (8): buildScrollableOverlay(), destroyOverlay(), finishCapture(), handleElement(), handleScrollable(), handleSelection(), startElementPicker(), startSelectionOverlay()

### Community 19 - "RSS & Web Import"
Cohesion: 0.29
Nodes (7): handleImportMessage(), fetchAndParseRssFeed(), parseAtomEntries(), parseRss2Items(), crawlUrls(), extractLinks(), normalizeUrl()

### Community 20 - "Snippet Display Utils"
Cohesion: 0.25
Nodes (2): tagColor(), TagPill()

### Community 21 - "JWT & Crypto Utilities"
Cohesion: 0.44
Nodes (8): base64urlToBytes(), base64urlToJson(), getPublicKey(), importJwk(), toNullableString(), toPlan(), toStatus(), verifyFirebaseIdToken()

### Community 22 - "Clipboard & Blob Processing"
Cohesion: 0.36
Nodes (6): blobToBase64(), createThumbnail(), handleCopyEvent(), sendToBackground(), setupClipboardMonitor(), main()

### Community 23 - "Storage Cache Layer"
Cohesion: 0.46
Nodes (6): evictSnippetTextsIfNeeded(), get(), getVersion(), invalidateAll(), set(), setVersion()

### Community 24 - "Image Compression Utils"
Cohesion: 0.6
Nodes (4): blobToDataUrl(), compressDataUrl(), cropAndCompressDataUrl(), dataUrlToBlob()

### Community 27 - "Source Google Doc Export"
Cohesion: 0.53
Nodes (1): SourceGoogleDocExportStrategy

### Community 28 - "Chat Google Doc Export"
Cohesion: 0.53
Nodes (1): GoogleDocExportStrategy

### Community 29 - "CSV Parser"
Cohesion: 0.53
Nodes (4): detectDelimiter(), detectUrlColumn(), parseCsv(), splitCsvLines()

### Community 30 - "Content Script Orchestration"
Cohesion: 0.33
Nodes (6): Adapter Registry, Chat Save Handler, Content Script Entrypoint, Send-To-Chat Content Module, Source Panel Enhancer, Studio Panel Enhancer

### Community 31 - "Chat History Handler"
Cohesion: 0.5
Nodes (2): buildFallbackConversation(), extractIdFromUrl()

### Community 32 - "Perplexity Adapter"
Cohesion: 0.5
Nodes (1): PerplexityAdapter

### Community 33 - "Copilot Adapter"
Cohesion: 0.5
Nodes (1): CopilotAdapter

### Community 34 - "ChatGPT Adapter"
Cohesion: 0.5
Nodes (1): ChatGPTAdapter

### Community 35 - "Claude Adapter"
Cohesion: 0.5
Nodes (1): ClaudeAdapter

### Community 36 - "Gemini Adapter"
Cohesion: 0.5
Nodes (1): GeminiAdapter

### Community 41 - "Audio Player Component"
Cohesion: 0.4
Nodes (2): AudioPlayer(), useAudioPlayer()

### Community 43 - "Navigation Context"
Cohesion: 0.4
Nodes (2): useNavigation(), useScreenshotsPage()

### Community 45 - "Plain Text Export"
Cohesion: 0.6
Nodes (1): PlainTextExportStrategy

### Community 46 - "Source Markdown Export"
Cohesion: 0.6
Nodes (1): SourceMarkdownExportStrategy

### Community 47 - "Markdown Export"
Cohesion: 0.6
Nodes (1): MarkdownExportStrategy

### Community 48 - "Source Plain Text Export"
Cohesion: 0.6
Nodes (1): SourcePlainTextExportStrategy

### Community 49 - "Drive Token Routing"
Cohesion: 0.6
Nodes (4): getDriveToken(), matchUrl(), routeUrls(), syncToDrive()

### Community 50 - "Source Delete Modal"
Cohesion: 0.67
Nodes (2): showSourceDeleteModal(), wireModal()

### Community 52 - "Subscription Guard"
Cohesion: 0.83
Nodes (3): getPlanLabel(), hasAccess(), SubscriptionGuard()

### Community 53 - "Snippet List Component"
Cohesion: 0.5
Nodes (2): SnippetList(), buildFolderMap()

### Community 58 - "Dashboard App Shell"
Cohesion: 0.5
Nodes (2): useDashboardApp(), useGlobalAudio()

### Community 59 - "Drive Sync Helpers"
Cohesion: 0.67
Nodes (2): getDriveToken(), syncToDrive()

### Community 61 - "Clipboard Capture Helpers"
Cohesion: 0.5
Nodes (4): createThumbnail, handleCopyEvent, sendToBackground (clipboard), setupClipboardMonitor

### Community 62 - "Source Export Modal"
Cohesion: 1.0
Nodes (2): showSourceExportModal(), wireModal()

### Community 69 - "Tag Card Component"
Cohesion: 1.0
Nodes (2): handleKeyDown(), handleRename()

### Community 77 - "Folder Card Component"
Cohesion: 1.0
Nodes (2): handleKeyDown(), handleRename()

### Community 79 - "Source PDF Export"
Cohesion: 0.67
Nodes (1): SourcePdfExportStrategy

### Community 80 - "PDF Export"
Cohesion: 0.67
Nodes (1): PdfExportStrategy

### Community 81 - "Notebook Annotation Drive Sync"
Cohesion: 1.0
Nodes (2): getDriveToken(), syncToDrive()

### Community 82 - "Pipeline Service Drive Sync"
Cohesion: 1.0
Nodes (2): getDriveToken(), syncToDrive()

### Community 83 - "Storage Shared Sync"
Cohesion: 1.0
Nodes (2): getDriveToken(), syncToDrive()

### Community 84 - "Folder & Snippet Filters"
Cohesion: 0.67
Nodes (3): filterSnippets, getFolderDescendantIds, getFolderSubtreeIds

### Community 85 - "Theme Provider"
Cohesion: 1.0
Nodes (3): ThemeContext, ThemeProvider, useTheme

### Community 86 - "CSV Bulk Import"
Cohesion: 0.67
Nodes (3): Bulk URL Import (CSV Flow), CsvParseResult Interface, CSV Parser (Bulk URL Import)

### Community 87 - "HTML Entrypoints"
Cohesion: 0.67
Nodes (3): Dashboard Entrypoint (HTML), Offscreen Entrypoint (HTML), Side Panel Entrypoint (HTML)

### Community 143 - "Extension Config"
Cohesion: 1.0
Nodes (2): Notebook Message Handler, WXT Extension Config

### Community 144 - "Tab Group Types"
Cohesion: 1.0
Nodes (2): StashedTab, TabGroup

### Community 145 - "Accordion UI Primitives"
Cohesion: 1.0
Nodes (2): Accordion UI Primitives, @radix-ui/react-accordion Primitive

### Community 146 - "NotebookLM Source Export Feature"
Cohesion: 1.0
Nodes (2): NotebookLM Source Export Feature, Studio Panel Enhancer (HTML)

### Community 204 - "Drive Message Handler"
Cohesion: 1.0
Nodes (1): Drive Message Handler

### Community 205 - "Import Message Handler"
Cohesion: 1.0
Nodes (1): Import Message Handler

### Community 206 - "Audio Message Handler"
Cohesion: 1.0
Nodes (1): Audio Message Handler

### Community 207 - "Message Type Guard"
Cohesion: 1.0
Nodes (1): isMessage

### Community 208 - "Chat History Handler"
Cohesion: 1.0
Nodes (1): Chat History Message Handler

### Community 209 - "Screenshot Handler"
Cohesion: 1.0
Nodes (1): Screenshot Message Handler

### Community 210 - "Pipeline Handler"
Cohesion: 1.0
Nodes (1): Pipeline Message Handler

### Community 211 - "Source Handler"
Cohesion: 1.0
Nodes (1): Source Message Handler

### Community 212 - "Export Record Type"
Cohesion: 1.0
Nodes (1): ExportRecord

### Community 213 - "Vite Raw Module Type"
Cohesion: 1.0
Nodes (1): Vite Raw Module Declaration

### Community 214 - "Notebook Collection Type"
Cohesion: 1.0
Nodes (1): NotebookCollection

### Community 215 - "Podcast Episode Type"
Cohesion: 1.0
Nodes (1): PodcastEpisode

### Community 216 - "Bulk Import Progress Type"
Cohesion: 1.0
Nodes (1): BulkImportProgress

### Community 217 - "Bulk Import Job Type"
Cohesion: 1.0
Nodes (1): BulkImportJob

### Community 218 - "Snippets Hook"
Cohesion: 1.0
Nodes (1): useSnippets

### Community 219 - "Snippets Provider"
Cohesion: 1.0
Nodes (1): SnippetsProvider

### Community 220 - "Navigation Hook"
Cohesion: 1.0
Nodes (1): useNavigation

### Community 221 - "Navigation Provider"
Cohesion: 1.0
Nodes (1): NavigationProvider

### Community 222 - "Subscription Hook"
Cohesion: 1.0
Nodes (1): useSubscription

### Community 223 - "Subscription Provider"
Cohesion: 1.0
Nodes (1): SubscriptionProvider

### Community 224 - "DOM Wait Utility"
Cohesion: 1.0
Nodes (1): waitForElement

### Community 225 - "Folder Path Utility"
Cohesion: 1.0
Nodes (1): getFolderPath

### Community 226 - "Folder Tree Items Utility"
Cohesion: 1.0
Nodes (1): getFolderTreeItems

### Community 227 - "Studio Adapter Type Guard"
Cohesion: 1.0
Nodes (1): isStudioPanelAdapter

### Community 228 - "Tag Filter HTML"
Cohesion: 1.0
Nodes (1): TagFilter Dropdown (HTML)

### Community 229 - "Screenshot Storage Service"
Cohesion: 1.0
Nodes (1): Screenshot Storage

### Community 230 - "Tab Groups Storage Service"
Cohesion: 1.0
Nodes (1): Tab Groups Storage

## Ambiguous Edges - Review These
- `ColorPicker` → `PromptsTable`  [AMBIGUOUS]
  src/components/dashboard/PromptsTable/PromptsTable.tsx · relation: conceptually_related_to
- `useChatHistoryDetailPage` → `allArtifactsCacheService`  [AMBIGUOUS]
  src/components/dashboard/ChatHistoryDetailPage/useChatHistoryDetailPage.ts · relation: conceptually_related_to
- `AnalyticsPage` → `AnalyticsPage`  [AMBIGUOUS]
  src/components/dashboard/AnalyticsPage/AnalyticsPage.tsx · relation: conceptually_related_to

## Knowledge Gaps
- **153 isolated node(s):** `WXT Extension Config`, `Drive Message Handler`, `Import Message Handler`, `Audio Message Handler`, `Background Shared Utilities` (+148 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `NotebookLM Automation`** (21 nodes): `NotebookLMAdapter`, `.autoConfirmDeleteDialog()`, `.delay()`, `.extractMessages()`, `.extractMessageText()`, `.extractPrompts()`, `.findHeaderAnchor()`, `.findNoteItems()`, `.findSourceItems()`, `.findSourceItemsContainer()`, `.findSourceMoreButton()`, `.findSourcePanelInjectionPoint()`, `.findStudioPanelInjectionPoint()`, `.getNoteTitle()`, `.getSourceTitle()`, `.getSourceType()`, `.readNoteContent()`, `.triggerSourceDelete()`, `.waitForMenuPanel()`, `.waitForNoteEditor()`, `notebooklm.adapter.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Snippet Display Utils`** (9 nodes): `countDescendants()`, `formatAge()`, `getSnippetTitle()`, `handleCopy()`, `handleSave()`, `repeat()`, `tagColor()`, `TagPill()`, `PromptHubView.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Source Google Doc Export`** (6 nodes): `SourceGoogleDocExportStrategy`, `.downloadFile()`, `.escapeHtml()`, `.export()`, `.formatAsHtml()`, `source-google-doc.export.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Chat Google Doc Export`** (6 nodes): `GoogleDocExportStrategy`, `.downloadFile()`, `.escapeHtml()`, `.export()`, `.formatAsHtml()`, `google-doc.export.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Chat History Handler`** (5 nodes): `buildFallbackConversation()`, `extractIdFromUrl()`, `getLLMPlatform()`, `handleChatHistoryMessage()`, `chat-history-handler.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Perplexity Adapter`** (5 nodes): `PerplexityAdapter`, `.extractMessages()`, `.extractPrompts()`, `.findHeaderAnchor()`, `perplexity.adapter.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Copilot Adapter`** (5 nodes): `CopilotAdapter`, `.extractMessages()`, `.extractPrompts()`, `.findHeaderAnchor()`, `copilot.adapter.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ChatGPT Adapter`** (5 nodes): `ChatGPTAdapter`, `.extractMessages()`, `.extractPrompts()`, `.findHeaderAnchor()`, `chatgpt.adapter.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Claude Adapter`** (5 nodes): `ClaudeAdapter`, `.extractMessages()`, `.extractPrompts()`, `.findHeaderAnchor()`, `claude.adapter.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Gemini Adapter`** (5 nodes): `GeminiAdapter`, `.extractMessages()`, `.extractPrompts()`, `.findHeaderAnchor()`, `gemini.adapter.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Audio Player Component`** (5 nodes): `AudioPlayer()`, `formatTime()`, `useAudioPlayer()`, `AudioPlayer.tsx`, `useAudioPlayer.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Navigation Context`** (5 nodes): `NavigationProvider()`, `useNavigation()`, `useScreenshotsPage()`, `useScreenshotsPage.ts`, `NavigationContext.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Plain Text Export`** (5 nodes): `PlainTextExportStrategy`, `.downloadFile()`, `.export()`, `.formatAsPlainText()`, `plain-text.export.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Source Markdown Export`** (5 nodes): `SourceMarkdownExportStrategy`, `.downloadFile()`, `.export()`, `.format()`, `source-markdown.export.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Markdown Export`** (5 nodes): `MarkdownExportStrategy`, `.downloadFile()`, `.export()`, `.formatAsMarkdown()`, `markdown.export.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Source Plain Text Export`** (5 nodes): `SourcePlainTextExportStrategy`, `.downloadFile()`, `.export()`, `.format()`, `source-plain-text.export.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Source Delete Modal`** (4 nodes): `setInteractionsDisabled()`, `showSourceDeleteModal()`, `wireModal()`, `source-delete-modal.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Snippet List Component`** (4 nodes): `SnippetList()`, `buildFolderMap()`, `SnippetList.tsx`, `useSnippetList.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dashboard App Shell`** (4 nodes): `useDashboardApp()`, `useGlobalAudio()`, `useDashboardApp.ts`, `useGlobalAudio.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Drive Sync Helpers`** (4 nodes): `contentKey()`, `getDriveToken()`, `syncToDrive()`, `chat-history-storage.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Source Export Modal`** (3 nodes): `showSourceExportModal()`, `wireModal()`, `source-export-modal.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tag Card Component`** (3 nodes): `TagCard.tsx`, `handleKeyDown()`, `handleRename()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Folder Card Component`** (3 nodes): `handleKeyDown()`, `handleRename()`, `FolderCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Source PDF Export`** (3 nodes): `SourcePdfExportStrategy`, `.export()`, `source-pdf.export.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PDF Export`** (3 nodes): `PdfExportStrategy`, `.export()`, `pdf.export.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Notebook Annotation Drive Sync`** (3 nodes): `getDriveToken()`, `syncToDrive()`, `notebook-annotation-service.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Pipeline Service Drive Sync`** (3 nodes): `getDriveToken()`, `syncToDrive()`, `pipeline-service.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Storage Shared Sync`** (3 nodes): `shared.ts`, `getDriveToken()`, `syncToDrive()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Extension Config`** (2 nodes): `Notebook Message Handler`, `WXT Extension Config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tab Group Types`** (2 nodes): `StashedTab`, `TabGroup`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Accordion UI Primitives`** (2 nodes): `Accordion UI Primitives`, `@radix-ui/react-accordion Primitive`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `NotebookLM Source Export Feature`** (2 nodes): `NotebookLM Source Export Feature`, `Studio Panel Enhancer (HTML)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Drive Message Handler`** (1 nodes): `Drive Message Handler`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Import Message Handler`** (1 nodes): `Import Message Handler`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Audio Message Handler`** (1 nodes): `Audio Message Handler`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Message Type Guard`** (1 nodes): `isMessage`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Chat History Handler`** (1 nodes): `Chat History Message Handler`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Screenshot Handler`** (1 nodes): `Screenshot Message Handler`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Pipeline Handler`** (1 nodes): `Pipeline Message Handler`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Source Handler`** (1 nodes): `Source Message Handler`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Export Record Type`** (1 nodes): `ExportRecord`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vite Raw Module Type`** (1 nodes): `Vite Raw Module Declaration`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Notebook Collection Type`** (1 nodes): `NotebookCollection`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Podcast Episode Type`** (1 nodes): `PodcastEpisode`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Bulk Import Progress Type`** (1 nodes): `BulkImportProgress`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Bulk Import Job Type`** (1 nodes): `BulkImportJob`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Snippets Hook`** (1 nodes): `useSnippets`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Snippets Provider`** (1 nodes): `SnippetsProvider`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Navigation Hook`** (1 nodes): `useNavigation`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Navigation Provider`** (1 nodes): `NavigationProvider`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Subscription Hook`** (1 nodes): `useSubscription`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Subscription Provider`** (1 nodes): `SubscriptionProvider`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DOM Wait Utility`** (1 nodes): `waitForElement`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Folder Path Utility`** (1 nodes): `getFolderPath`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Folder Tree Items Utility`** (1 nodes): `getFolderTreeItems`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Studio Adapter Type Guard`** (1 nodes): `isStudioPanelAdapter`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tag Filter HTML`** (1 nodes): `TagFilter Dropdown (HTML)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Screenshot Storage Service`** (1 nodes): `Screenshot Storage`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tab Groups Storage Service`** (1 nodes): `Tab Groups Storage`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `ColorPicker` and `PromptsTable`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `useChatHistoryDetailPage` and `allArtifactsCacheService`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `AnalyticsPage` and `AnalyticsPage`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `useUsageLimit` connect `Dashboard UI Views` to `Dashboard Pages & Components`, `Core Services Layer`, `Screenshot Annotation`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `DashboardApp Root Component` connect `Background Message Handlers` to `Core Services Layer`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `useDashboardApp Hook` connect `Core Services Layer` to `Background Message Handlers`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Background Service Worker` (e.g. with `AuthButton Component` and `useDashboardApp Hook`) actually correct?**
  _`Background Service Worker` has 3 INFERRED edges - model-reasoned connections that need verification._