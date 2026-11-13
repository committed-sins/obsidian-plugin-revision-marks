const CALLBACK_NAMES = ['callback', 'editorCallback', 'checkCallback', 'editorCheckCallback'];

/**
 * Obsidian has no public post-save event. Wrap execution callbacks only, retain
 * their bindings/return values and leave availability checks without side effects.
 * @returns {() => void} Restore callbacks still owned by this registration.
 */
export function registerSaveCommand({ app, complete, isStopped, report })
{
    const command = app.commands?.commands?.['editor:save-file'];
    const restorers = [];

    if (command) {
        for (const name of CALLBACK_NAMES) {
            const original = command[name];
            if (typeof original !== 'function') continue;

            const wrapped = function(...args)
            {
                const path = app.workspace.getActiveFile()?.path;
                const result = original.apply(this, args);
                const checkingAvailability = name.toLowerCase().includes('check') && args[0];
                if (!checkingAvailability && path) {
                    void Promise.resolve(result)
                        .then(() =>
                        {
                            if (!isStopped()) return complete(path);
                        })
                        .catch(report);
                }
                return result;
            };

            command[name] = wrapped;
            restorers.push(() =>
            {
                if (command[name] === wrapped) command[name] = original;
            });
        }
    }

    if (!restorers.length) {
        report(
            new Error(
                'Save current file command could not be hooked; Ctrl+S session completion is unavailable.',
            ),
        );
    }
    return () => restorers.forEach((restore) => restore());
}
