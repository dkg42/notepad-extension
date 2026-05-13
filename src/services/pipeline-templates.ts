/**
 * @module pipeline-templates
 * @description Static catalogue of pre-built pipeline rule templates displayed in the Template Gallery on the Pipelines page. Templates are not auto-installed; the user clicks "Install" which calls pipelineService.save() with a copy. Collection IDs, tag names, and URLs inside templates are placeholder values that must be filled in via the PipelineBuilder before the pipeline is activated.
 * @dependencies (none — pure data, no internal src/ imports)
 * @public PIPELINE_TEMPLATES
 */
import type { Pipeline } from '@/types';

/**
 * Pre-built pipeline rule templates.
 *
 * These are NOT auto-installed. The user browses the Template Gallery in the
 * Pipelines page and clicks "Install" to call pipelineService.save() with a
 * copy of the template. Collection/tag placeholder values should be filled in
 * via the PipelineBuilder before the pipeline is activated.
 */
export const PIPELINE_TEMPLATES: Pipeline[] = [
  {
    id: 'template-audio-generator',
    name: 'Audio Generator',
    description:
      'Automatically generates a Deep Dive audio overview once a notebook reaches 5 or more sources.',
    enabled: false,
    trigger: { type: 'min-sources', threshold: 5 },
    actions: [{ type: 'generate-audio', format: 1 }],
    scope: { kind: 'all' },
    createdAt: 0,
    updatedAt: 0,
    isTemplate: true,
  },
  {
    id: 'template-escalator',
    name: 'The Escalator',
    description:
      'When the "ready" tag is added to a notebook, removes the "draft" tag and moves it to the "Published" folder.',
    enabled: false,
    trigger: { type: 'notebook-tag-added', tag: 'ready' },
    actions: [
      { type: 'remove-tag', tag: 'draft' },
      { type: 'move-to-folder', folderId: '' }, // user fills in folderId
    ],
    scope: { kind: 'all' },
    createdAt: 0,
    updatedAt: 0,
    isTemplate: true,
  },
  {
    id: 'template-podcast-pipeline',
    name: 'Podcast Pipeline',
    description:
      'When audio is generated for a notebook, moves it to the "Podcast Ready" folder and tags it with "podcast".',
    enabled: false,
    trigger: { type: 'audio-generated' },
    actions: [
      { type: 'move-to-folder', folderId: '' }, // user fills in folderId
      { type: 'add-tag', tag: 'podcast' },
    ],
    scope: { kind: 'all' },
    createdAt: 0,
    updatedAt: 0,
    isTemplate: true,
  },
  {
    id: 'template-smart-sort',
    name: 'Smart Sort',
    description:
      'When a notebook is moved to a folder, automatically tags it with the folder name for easy cross-view filtering.',
    enabled: false,
    trigger: { type: 'moved-to-folder', folderId: '' }, // user fills in folderId
    actions: [{ type: 'add-tag', tag: '' }], // user fills in tag to match folder name
    scope: { kind: 'all' },
    createdAt: 0,
    updatedAt: 0,
    isTemplate: true,
  },
  {
    id: 'template-the-cleaner',
    name: 'The Cleaner',
    description:
      'Once audio is generated for a notebook, deletes all sources to free up NotebookLM storage quota.',
    enabled: false,
    trigger: { type: 'audio-generated' },
    actions: [{ type: 'delete-all-sources' }],
    scope: { kind: 'all' },
    createdAt: 0,
    updatedAt: 0,
    isTemplate: true,
  },
  {
    id: 'template-template-engine',
    name: 'Template Engine',
    description:
      'When a notebook is moved to a specific folder, automatically adds a starter source URL (e.g. a research template).',
    enabled: false,
    trigger: { type: 'moved-to-folder', folderId: '' }, // user fills in folderId
    actions: [{ type: 'add-source-url', url: '' }], // user fills in template URL
    scope: { kind: 'all' },
    createdAt: 0,
    updatedAt: 0,
    isTemplate: true,
  },
  {
    id: 'template-domain-router',
    name: 'Domain Router',
    description:
      'When a new source is added to a notebook, tags the notebook with a domain label for routing and categorisation.',
    enabled: false,
    trigger: { type: 'source-added' },
    actions: [{ type: 'add-tag', tag: '' }], // user fills in domain tag
    scope: { kind: 'all' },
    createdAt: 0,
    updatedAt: 0,
    isTemplate: true,
  },
];
