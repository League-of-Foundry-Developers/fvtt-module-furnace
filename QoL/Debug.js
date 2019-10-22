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
    static log(...args) {
        if (CONFIG.FurnaceEnableDebug)
            console.log("Furnace : ", ...args);
    }
}

// Replace functions here so we can debug the call to 'init'
FurnacePatching.replaceFunction(Hooks, "callAll", function (hook, ...args) {
    if (CONFIG.FurnaceEnableDebug) {
        args_comma = []
        args.forEach(a => { args_comma.push(a); args_comma.push(",") })
        args_comma.pop();
        console.log("DEBUG | Calling All Hooks : " + hook + "(", ...args_comma, ")")
    }
    FurnacePatching.callOriginalFunction(this, "callAll", hook, ...args)
});
FurnacePatching.replaceFunction(Hooks, "call", function (hook, ...args) {
    if (CONFIG.FurnaceEnableDebug) {
        args_comma = []
        args.forEach(a => { args_comma.push(a); args_comma.push(",") })
        args_comma.pop();
        console.log("DEBUG | Calling Hook : " + hook + "(", ...args_comma, ")")
    }
    FurnacePatching.callOriginalFunction(this, "call", hook, ...args)
});

Hooks.on('init', FurnaceDebug.init)