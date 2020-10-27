CONFIG.debug.furnace = true;

class FurnaceDebug {
    static init() {
        game.settings.register("furnace", "enableDebug", {
            name: game.i18n.localize("FURNACE.SETTINGS.enableDebug"),
            hint: game.i18n.localize("FURNACE.SETTINGS.enableDebugHint"),
            scope: "client",
            config: true,
            default: false,
            type: Boolean,
            onChange: value => {
                CONFIG.debug.furnace = value
                this.maybePatchHooks();
            }
        });
        CONFIG.debug.furnace = game.settings.get("furnace", "enableDebug");
        this.maybePatchHooks();
    }
    static log(...args) {
        if (CONFIG.debug.furnace)
            console.log("Furnace : ", ...args);
    }
    static maybePatchHooks() {
        if (!CONFIG.debug.furnace) return;
        if (this._patchApplied) return;
        this._patchApplied = true;
        // Replace functions here so we can debug the call to 'init'
        FurnacePatching.replaceFunction(Hooks, "callAll", function (hook, ...args) {
            if (CONFIG.debug.furnace) {
                const args_comma = []
                args.forEach(a => { args_comma.push(a); args_comma.push(",") })
                args_comma.pop();
                console.log("DEBUG | Calling All Hooks : " + hook + "(", ...args_comma, ")")
            }
            return FurnacePatching.callOriginalFunction(this, "callAll", hook, ...args)
        });
        FurnacePatching.replaceFunction(Hooks, "call", function (hook, ...args) {
            if (CONFIG.debug.furnace) {
                const args_comma = []
                args.forEach(a => { args_comma.push(a); args_comma.push(",") })
                args_comma.pop();
                console.log("DEBUG | Calling Hook : " + hook + "(", ...args_comma, ")")
            }
            return FurnacePatching.callOriginalFunction(this, "call", hook, ...args)
        });
    }
}

Hooks.on('init', () => FurnaceDebug.init())