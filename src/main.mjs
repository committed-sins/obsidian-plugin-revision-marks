import * as obsidian from 'obsidian';
import { EditorView } from '@codemirror/view';
import { createPluginClass } from './plugin.mjs';

export default createPluginClass({ ...obsidian, EditorView });
