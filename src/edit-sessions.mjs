// One metadata update per completed, genuinely changed editor session.
// Dependencies are injected so the state machine can also be tested outside Obsidian.
export const EXCLUDED_FOLDERS = ["archives", "scripts", "libraries", "templates", "inbound"];
const IGNORED_PROPERTIES = new Set(["updated", "updated_count"]);
export const eligibleNote = (path, excludedFolders = EXCLUDED_FOLDERS) => path.endsWith(".md") && !excludedFolders.some(folder => path === folder || path.startsWith(folder + "/"));

export function comparableContent(text, api, comparisonVersion = 2) {
    text = text.replace(/\r\n?/g, "\n");
    const info = api.getFrontMatterInfo(text);
    const properties = info.exists ? api.parseYaml(info.frontmatter) ?? {} : {};
    if (typeof properties !== "object" || Array.isArray(properties)) throw new Error("Frontmatter must be a mapping");
    const stable = value => {
        if (value instanceof Date) return value.toISOString();
        if (Array.isArray(value)) return value.map(stable);
        if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
        return value;
    };
    const relevant = Object.fromEntries(Object.entries(properties).filter(([key]) => !IGNORED_PROPERTIES.has(key) && !(comparisonVersion === 1 && key === "created")));
    return JSON.stringify(stable(relevant)) + "\n" + (info.exists ? text.slice(info.contentStart) : text);
}

export function metadataOf(text, api) {
    const info = api.getFrontMatterInfo(text);
    const fm = info.exists ? api.parseYaml(info.frontmatter) ?? {} : {};
    const count = fm.updated_count ?? 0;
    if (!Number.isSafeInteger(count) || count < 0) throw new Error("updated_count must be a non-negative integer");
    return { count, updated: fm.updated instanceof Date ? fm.updated.toISOString() : fm.updated ?? null };
}

async function sha256(text) {
    const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function createSessionTracker({ api, storage, storageKey, read, write, exists,
    isActive = () => false, now = () => new Date(), hash = sha256, report = console.error, isEligible = eligibleNote }) {
    const sessions = new Map();
    const baselines = new Map();
    let queue = Promise.resolve();
    let available = true;
    const save = () => {
        const entries = [...sessions.values()].map(session => session.record).filter(Boolean);
        storage.setItem(storageKey, JSON.stringify({ version: 1, entries }));
    };
    let baselineDirty = false;
    const saveBaselines = () => {
        if (!baselineDirty) return;
        storage.setItem(storageKey + ":baselines", JSON.stringify({ version: 2, entries: [...baselines] }));
        baselineDirty = false;
    };
    const remember = (path, contentHash, metadata, mtime) => {
        baselines.set(path, { hash: contentHash, count: metadata.count, updated: metadata.updated, mtime }); baselineDirty = true;
    };
    try {
        const raw = storage.getItem(storageKey);
        if (raw) {
            const journal = JSON.parse(raw);
            if (journal.version !== 1 || !Array.isArray(journal.entries)) throw new Error("Unknown journal format");
            for (const record of journal.entries) {
                if (typeof record.path !== "string" || !/^[a-f0-9]{64}$/.test(record.baselineHash) ||
                    !/^[a-f0-9]{64}$/.test(record.latestHash) || !Number.isFinite(Date.parse(record.editedAt)) ||
                    !record.initial || !Number.isSafeInteger(record.initial.count) || record.initial.count < 0) {
                    throw new Error("Invalid session journal entry");
                }
                if (!isEligible(record.path)) continue;
                record.comparisonVersion ??= 1;
                sessions.set(record.path, { record });
            }
        }
        const rawBaselines = storage.getItem(storageKey + ":baselines");
        if (rawBaselines) {
            const saved = JSON.parse(rawBaselines);
            if (saved.version !== 2 || !Array.isArray(saved.entries)) throw new Error("Unknown baseline format");
            for (const [path, entry] of saved.entries) {
                if (typeof path !== "string" || !/^[a-f0-9]{64}$/.test(entry.hash) || !Number.isSafeInteger(entry.count) || entry.count < 0) throw new Error("Invalid baseline entry");
                if (isEligible(path)) baselines.set(path, entry);
            }
        }
    } catch (error) {
        available = false; // Never replace an unreadable journal with an empty one.
        report(error);
    }
    const eligible = isEligible;
    const enqueue = operation => {
        const result = queue.then(operation);
        queue = result.catch(report);
        return queue;
    };
    const snapshot = async (session, path) => {
        if (session.before === undefined || session.savedRevision === session.revision) return;
        const revision = session.revision;
        const editedAt = session.editedAt;
        const comparisonVersion = session.record?.comparisonVersion ?? 2;
        const [baselineHash, latestHash] = await Promise.all([
            session.record ? session.record.baselineHash : hash(comparableContent(session.before, api, comparisonVersion)),
            hash(comparableContent(session.after, api, comparisonVersion))
        ]);
        const initial = session.record?.initial ?? metadataOf(session.before, api);
        session.record = { ...session.record, path, baselineHash, latestHash, initial, editedAt, comparisonVersion };
        session.savedRevision = revision;
    };
    const change = (path, before, after) => {
        if (!available || !eligible(path)) return;
        const session = sessions.get(path) ?? {};
        session.before ??= before;
        session.after = after;
        session.editedAt = now().toISOString();
        session.revision = (session.revision ?? 0) + 1;
        sessions.set(path, session);
    };
    const checkpoint = () => enqueue(async () => {
        if (!available) return;
        for (const [path, session] of sessions) await snapshot(session, path);
        save(); saveBaselines();
    });
    const observe = (path, text, mtime) => enqueue(async () => {
        if (!available || !eligible(path)) return;
        const contentHash = await hash(comparableContent(text, api));
        const metadata = metadataOf(text, api);
        const previous = baselines.get(path);
        const session = sessions.get(path);
        if (!previous) {
            if (session) return; // Its first user transaction supplies the missing pre-image.
            remember(path, contentHash, metadata, mtime); return;
        }
        if (contentHash === previous.hash || metadata.count !== previous.count || metadata.updated !== previous.updated) {
            // Metadata-only changes and already-stamped sync changes do not create another edit.
            remember(path, contentHash, metadata, mtime);
            if (session?.record?.source === "file") { sessions.delete(path); save(); }
            return;
        }
        if (session?.before !== undefined) return; // Preserve the editor's exact before/after documents.
        const editedAt = new Date(mtime).toISOString();
        sessions.set(path, { record: { path, baselineHash: previous.hash, latestHash: contentHash,
            initial: { count: previous.count, updated: previous.updated }, editedAt, comparisonVersion: 2, source: "file" } });
        save();
    });
    const finish = (path, { force = false } = {}) => enqueue(async () => {
        if (!available || (!force && isActive(path))) return;
        const session = sessions.get(path);
        if (!session) return;
        await snapshot(session, path);
        const revision = session.revision;
        const canWrite = () => sessions.get(path) === session && session.revision === revision && (force || !isActive(path));
        const record = session.record;
        if (!record || !eligible(path) || !exists(path)) {
            sessions.delete(path); save(); return;
        }
        const loaded = await read(path, { saveEditors: record.source !== "file" });
        const text = typeof loaded === "string" ? loaded : loaded.text;
        const mtime = typeof loaded === "string" ? undefined : loaded.mtime;
        if (!canWrite()) { save(); return; }
        const contentHash = await hash(comparableContent(text, api, record.comparisonVersion));
        const canonicalHash = record.comparisonVersion === 2 ? contentHash : await hash(comparableContent(text, api));
        const metadata = metadataOf(text, api);
        if (record.intent && metadata.count === record.intent.count && metadata.updated === record.intent.updated) {
            if (contentHash === record.latestHash) {
                remember(path, canonicalHash, metadata, mtime);
                sessions.delete(path); save(); saveBaselines(); return; // Commit succeeded before interruption.
            }
            // The old commit succeeded, followed by another unstamped content change.
            record.baselineHash = record.latestHash;
            record.initial = metadata;
            delete record.intent;
        }
        if (contentHash === record.baselineHash) {
            remember(path, canonicalHash, metadata, mtime);
            sessions.delete(path); save(); saveBaselines(); return; // Includes a complete undo.
        }
        if (metadata.count !== record.initial.count || metadata.updated !== record.initial.updated) {
            remember(path, canonicalHash, metadata, mtime);
            sessions.delete(path); save(); saveBaselines(); return; // Another writer already accounted for the change.
        }
        if (contentHash !== record.latestHash && !Number.isFinite(mtime)) {
            save(); throw new Error(`Edit sessions: ${path} changed externally without a known mtime; pending session retained.`);
        }
        record.latestHash = contentHash;
        const editedAt = Number.isFinite(mtime) && mtime > 0 ? new Date(mtime).toISOString() : record.editedAt;
        const proposed = record.intent?.updated ?? api.formatDate(editedAt);
        const existingTime = typeof metadata.updated === "string" ? Date.parse(metadata.updated) : NaN;
        const proposedTime = Date.parse(proposed);
        const updateTimestamp = !Number.isFinite(existingTime) || existingTime < proposedTime;
        // Compare instants, not timezone spellings; never move a valid stamp backwards.
        // Compare the formatted value so sub-second mtime differences don't cause rewrites.
        record.intent = { count: record.intent?.count ?? metadata.count + 1,
            updated: updateTimestamp ? proposed : metadata.updated, updateTimestamp };
        if (!Number.isSafeInteger(record.intent.count)) throw new Error("updated_count overflow");
        save(); // Write-ahead record: retry must never increment twice.
        if (!canWrite()) return;
        await write(path, record.intent, metadata, contentHash, { canWrite, force, comparisonVersion: record.comparisonVersion });
        remember(path, canonicalHash, record.intent, mtime);
        if (session.revision === revision) sessions.delete(path);
        else {
            // Input after the write belongs to a fresh session, not to the just-committed one.
            session.record = { path, baselineHash: canonicalHash, latestHash: canonicalHash,
                initial: { count: record.intent.count, updated: record.intent.updated }, editedAt: session.editedAt, comparisonVersion: 2 };
            session.savedRevision = undefined;
        }
        save(); saveBaselines();
    });
    const rename = (oldPath, newPath) => {
        if (oldPath === newPath) return queue;
        for (const path of new Set([...baselines.keys(), ...sessions.keys()])) {
            if (path !== oldPath && !path.startsWith(oldPath + "/")) continue;
            const target = newPath + path.slice(oldPath.length);
            if (eligible(target)) {
                if (baselines.has(path)) baselines.set(target, baselines.get(path));
                if (sessions.has(path)) {
                    const session = sessions.get(path);
                    sessions.set(target, session);
                    if (session.record) session.record.path = target;
                }
            }
            baselines.delete(path); sessions.delete(path); baselineDirty = true;
        }
        return enqueue(async () => { if (available) { save(); saveBaselines(); } });
    };
    const remove = path => {
        for (const candidate of new Set([...baselines.keys(), ...sessions.keys()])) {
            if (candidate === path || candidate.startsWith(path + "/")) { baselines.delete(candidate); sessions.delete(candidate); baselineDirty = true; }
        }
        return enqueue(async () => { if (available) { save(); saveBaselines(); } });
    };
    return { change, observe, checkpoint, finish, rename, remove, baseline: path => baselines.get(path),
        knownPaths: () => [...baselines.keys()], hasEditorChanges: path => sessions.get(path)?.before !== undefined,
        paths: () => [...sessions.keys()], idle: () => queue };
}

export function startEditSessions(app, api) {
    const owner = api.owner;
    if (!owner?.registerEditorExtension) throw new Error("Session Marks requires its plugin lifecycle owner");
    const eligible = path => eligibleNote(path, api.excludedFolders ?? EXCLUDED_FOLDERS);
    const slotKey = Symbol.for("session-marks.editorListener");
    // Keep one extension per plugin instance, including settings restarts.
    if (!owner[slotKey]) {
        const slot = owner[slotKey] = { listener: null };
        owner.registerEditorExtension(api.EditorView.updateListener.of(update => slot.listener?.(update)));
    }
    const slot = owner[slotKey];
    let stopped = false, checkpointTimer, leavingTimer, initializationTimer;
    let diskQueue = Promise.resolve();
    let flushQueue = Promise.resolve();
    const refs = [];
    const reported = new Set();
    const report = error => {
        console.error("Session Marks", error);
        const message = `Edit sessions: ${error.message ?? error}`;
        if (!reported.has(message)) { reported.add(message); new api.Notice(message, 10000); }
    };
    const fileAt = path => app.vault.getAbstractFileByPath(path);
    const writing = new Set();
    const active = path => app.workspace.getActiveFile()?.path === path;
    const recovering = new Set();
    const blocked = path => active(path) && !recovering.has(path);
    const viewsFor = path => {
        const views = [];
        app.workspace.iterateAllLeaves(leaf => {
            if (leaf.view.file?.path === path && leaf.view.editor) views.push(leaf.view);
        });
        return views;
    };
    const storageKey = "session-marks.v1:" + (app.vault.adapter.getBasePath?.() ?? app.vault.getName());
    const saveViews = async path => {
        const views = viewsFor(path);
        const buffers = new Set(views.map(view => view.editor.getValue().replace(/\r\n?/g, "\n")));
        if (buffers.size > 1) throw new Error(`${path} has divergent editor buffers; completion deferred`);
        const disk = await app.vault.read(fileAt(path));
        for (const view of views) {
            const same = view.editor.getValue().replace(/\r\n?/g, "\n") === disk.replace(/\r\n?/g, "\n");
            if (same || view.dirty === true || (tracker.hasEditorChanges(path) && view.dirty !== false)) await view.save();
        }
    };
    const tracker = createSessionTracker({
        api, storage: globalThis.localStorage, storageKey, isActive: blocked, report, isEligible: eligible,
        exists: path => Boolean(fileAt(path)),
        read: async (path, { saveEditors = true } = {}) => {
            if (saveEditors) await saveViews(path);
            const file = fileAt(path);
            const text = await app.vault.read(file);
            return { text, mtime: file.stat?.mtime };
        },
        write: async (path, intent, expected, expectedHash, context) => {
            if (!context.canWrite()) throw new Error(`${path} changed during session completion; update deferred`);
            const file = fileAt(path);
            const disk = await app.vault.read(file);
            if (await sha256(comparableContent(disk, api, context.comparisonVersion)) !== expectedHash) {
                throw new Error(`${path} changed before metadata write; update deferred`);
            }
            const checkBuffers = () => {
                for (const view of viewsFor(path)) {
                    if (view.dirty === true || comparableContent(view.editor.getValue(), api, context.comparisonVersion) !== comparableContent(disk, api, context.comparisonVersion)) {
                        throw new Error(`${path} has unsaved or stale editor content; metadata update deferred`);
                    }
                }
            };
            checkBuffers();
            writing.add(path);
            try {
                await app.fileManager.processFrontMatter(file, fm => {
                    if (!context.canWrite()) throw new Error(`${path} changed during metadata write`);
                    checkBuffers();
                    const count = fm.updated_count ?? 0;
                    const updated = fm.updated instanceof Date ? fm.updated.toISOString() : fm.updated ?? null;
                    if (count !== expected.count || updated !== expected.updated) throw new Error(`${path} metadata changed concurrently`);
                    const needsOrder = !Object.hasOwn(fm, "updated") || !Object.hasOwn(fm, "updated_count");
                    if (needsOrder && typeof api.orderFrontmatter !== "function") throw new Error("Frontmatter order helper is unavailable");
                    if (intent.updateTimestamp !== false) fm.updated = intent.updated;
                    fm.updated_count = intent.count;
                    if (needsOrder) api.orderFrontmatter(fm);
                });
            } finally { writing.delete(path); }
        }
    });
    const checkpointSoon = () => {
        clearTimeout(checkpointTimer);
        checkpointTimer = setTimeout(() => { void tracker.checkpoint(); }, 300);
    };
    slot.listener = update => {
        if (stopped || !update.docChanged || !update.transactions.some(tr =>
            ["input", "delete", "move", "undo", "redo"].some(event => tr.isUserEvent(event)))) return;
        const info = update.state.field(api.editorInfoField, false);
        const file = info?.file;
        if (!file || !active(file.path)) return;
        // Embedded/table-cell editors must not be mistaken for a whole note.
        if (info.editor?.getValue() !== update.state.doc.toString()) return;
        if (writing.has(file.path) && comparableContent(update.startState.doc.toString(), api) === comparableContent(update.state.doc.toString(), api)) return;
        recovering.delete(file.path); // Never recover into a note the user has started editing.
        tracker.change(file.path, update.startState.doc.toString(), update.state.doc.toString());
        checkpointSoon();
    };
    const finishInactive = () => {
        clearTimeout(leavingTimer);
        leavingTimer = setTimeout(() => {
            if (stopped) return;
            for (const path of tracker.paths()) if (!active(path)) void tracker.finish(path);
        }, 150);
    };
    const observeFile = file => {
        if (stopped || !file || !eligible(file.path) || writing.has(file.path)) return diskQueue;
        const path = file.path;
        diskQueue = diskQueue.then(async () => {
            if (stopped || !fileAt(path)) return;
            const text = await app.vault.read(fileAt(path));
            if (!fileAt(path)) return;
            const mtime = fileAt(path)?.stat?.mtime;
            await tracker.observe(path, text, Number.isFinite(mtime) ? mtime : Date.now());
            checkpointSoon();
            if (!active(path)) await tracker.finish(path);
        }).catch(report);
        return diskQueue;
    };
    const flush = onlyPath => {
        flushQueue = flushQueue.then(async () => {
        // Save buffers first, then consume their modify events, then close the session(s).
        const paths = new Set();
        app.workspace.iterateAllLeaves(leaf => {
            const view = leaf.view;
            if (view.editor && eligible(view.file?.path ?? "") && (!onlyPath || view.file.path === onlyPath)) paths.add(view.file.path);
        });
        for (const path of paths) await saveViews(path);
        // Include final disk changes even if their modify event hasn't been handled yet.
        for (const path of paths) await observeFile(fileAt(path));
        if (onlyPath && !paths.has(onlyPath)) await observeFile(fileAt(onlyPath));
        await diskQueue;
        await tracker.checkpoint();
        for (const path of tracker.paths()) if (!onlyPath || path === onlyPath) await tracker.finish(path, { force: true });
        await tracker.checkpoint();
        }).catch(report);
        return flushQueue;
    };
    refs.push([app.vault, app.vault.on("modify", observeFile)]);
    refs.push([app.vault, app.vault.on("create", observeFile)]);
    refs.push([app.workspace, app.workspace.on("active-leaf-change", finishInactive)]);
    refs.push([app.workspace, app.workspace.on("file-open", finishInactive)]);
    refs.push([app.workspace, app.workspace.on("layout-change", finishInactive)]);
    refs.push([app.vault, app.vault.on("rename", (file, oldPath) => { void tracker.rename(oldPath, file.path); })]);
    refs.push([app.vault, app.vault.on("delete", file => { void tracker.remove(file.path); })]);
    refs.push([app.workspace, app.workspace.on("quit", tasks => {
        if (tasks?.add) tasks.add(() => flush());
        else return flush().catch(report);
    })]);
    const onHide = () => { if (globalThis.document?.visibilityState === "hidden") void flush().catch(report); };
    const onMobileBlur = () => { void flush().catch(report); };
    globalThis.document?.addEventListener("visibilitychange", onHide);
    globalThis.window?.addEventListener("pagehide", onMobileBlur);
    if (api.Platform?.isMobile) globalThis.window?.addEventListener("blur", onMobileBlur);
    // The core save command has no public post-save event. Wrap only its execution
    // callbacks, preserving availability checks, original return values and bindings.
    const saveCommand = app.commands?.commands?.["editor:save-file"];
    const restoreSaveCallbacks = [];
    if (saveCommand) {
        for (const name of ["callback", "editorCallback", "checkCallback", "editorCheckCallback"]) {
            const original = saveCommand[name];
            if (typeof original !== "function") continue;
            const wrapped = function (...args) {
                const path = app.workspace.getActiveFile()?.path;
                const result = original.apply(this, args);
                if (!(name.toLowerCase().includes("check") && args[0]) && path) {
                    void Promise.resolve(result).then(() => { if (!stopped) return flush(path); }).catch(report);
                }
                return result;
            };
            saveCommand[name] = wrapped;
            restoreSaveCallbacks.push(() => { if (saveCommand[name] === wrapped) saveCommand[name] = original; });
        }
    }
    if (!restoreSaveCallbacks.length) report(new Error("Save current file command could not be hooked; Ctrl+S session completion is unavailable."));
    const interval = setInterval(() => { void tracker.checkpoint(); }, 5000);
    // Recover the previous app run before treating new input as a new session.
    // Typing into the note cancels its active-file recovery permission immediately.
    for (const path of tracker.paths()) {
        recovering.add(path);
        void tracker.finish(path).finally(() => recovering.delete(path));
    }
    // First run establishes fingerprints without backdating the vault. Later starts
    // read only changed file stats. Work is paced so mobile startup remains usable.
    const initialize = async () => {
        let batch = 0;
        const files = app.vault.getMarkdownFiles?.() ?? [];
        const paths = new Set(files.map(file => file.path));
        for (const path of tracker.knownPaths()) if (!paths.has(path)) await tracker.remove(path);
        for (const path of paths) {
            if (stopped) return;
            if (!eligible(path)) continue;
            const file = fileAt(path);
            const baseline = tracker.baseline(path);
            if (!baseline || baseline.mtime !== file?.stat?.mtime) await observeFile(file);
            if (++batch % 16 === 0) await new Promise(resolve => setTimeout(resolve, 20));
            if (batch % 128 === 0) await tracker.checkpoint();
        }
        await tracker.checkpoint();
    };
    initializationTimer = setTimeout(() => { void initialize().catch(report); }, 1000);
    finishInactive();
    const stop = () => {
        stopped = true;
        slot.listener = null;
        clearTimeout(checkpointTimer); clearTimeout(leavingTimer); clearTimeout(initializationTimer); clearInterval(interval);
        for (const [emitter, ref] of refs) emitter.offref(ref);
        globalThis.document?.removeEventListener("visibilitychange", onHide);
        globalThis.window?.removeEventListener("pagehide", onMobileBlur);
        globalThis.window?.removeEventListener("blur", onMobileBlur);
        restoreSaveCallbacks.forEach(restore => restore());
        // Plugin cleanup can be reached without a preceding workspace quit.
        // Do not leave a known pending session as journal-only in that case.
        return flush().then(() => diskQueue).then(() => tracker.checkpoint());
    };
    stop.complete = flush;
    stop.pendingPaths = () => tracker.paths();
    return stop;
}
