CONFIG.FurnaceEnableDebug = true;

class FurnaceDebug {
    static init() {
            
        game.settings.register("furnace", "enableDebug", {
            name: "Enable Debugging",
            hint: "Useful for module developers",
            scope: "core",
            config: true,
            default: false,
            type: Boolean,
            onChange: value => {
                CONFIG.FurnaceEnableDebug = value
            }
        });
        CONFIG.FurnaceEnableDebug = game.settings.get("furnace", "enableDebug");
    }
}
Hooks._furnace_original_callAll = Hooks.callAll;
Hooks._furnace_original_call = Hooks.call;
Hooks.callAll = function (hook, ...args) {
    if (CONFIG.FurnaceEnableDebug)
        console.log("Calling All Hooks : " + hook + "(", args, ")")
    Hooks._furnace_original_callAll(hook, ...args)
}
Hooks.call = function (hook, ...args) {
    if (CONFIG.FurnaceEnableDebug)
        console.log("Calling Hook : " + hook + "(", args, ")")
    Hooks._furnace_original_call(hook, ...args)
}

Hooks.on('init', FurnaceDebug.init)