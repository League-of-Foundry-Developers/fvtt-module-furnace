class FurnaceMacros {
    constructor() {
        let helpers = {
            macro: (name, ...args) => {
                const macro = game.macros.entities.find(macro => macro.name === name);
                if (!macro) return "";
                const result = macro.render(...args);
                if (typeof(result) !== "string")
                    return "";
                return result;
            }
        }
        Handlebars.registerHelper(helpers)

        Hooks.on('init', this.init.bind(this));
        Hooks.on('renderMacroConfig', this.renderMacroConfig.bind(this))
    }

    init() {
        // Register module configuration settings
        game.settings.register("furnace", "enableMacros", {
            name: "Advanced Macros",
            hint: "Enable the parsing of the text chat to support /macro as a Handlebars template acting as a macro system (experimental feature).",
            scope: "world",
            config: true,
            default: false,
            type: Boolean,
        });
        game.macros = this;

        Hooks.on('preCreateChatMessage', this.preCreateChatMessage.bind(this))
        FurnacePatching.replaceMethod(Macro, "execute", this.executeMacro)
        Macro.prototype.render = this.renderMacro;
    }

    static getTemplateContext(args=null) {
        const speaker = ChatMessage.getSpeaker();
        const actor = game.actors.get(speaker.actor);
        const token = canvas.tokens.get(speaker.token);
        const character = game.user.character;
        return { game: game, ui: ui, canvas: canvas, speaker, actor, token, character, args }
    }
    
    renderMacro(...args) {
        const context = FurnaceMacros.getTemplateContext(args);
        if ( this.data.type === "chat" ) {
            if (this.data.command.includes("{{")) {
                const compiled = Handlebars.compile(this.data.command);
                return compiled(context)
            } else {
                return this.data.command;
            }
        }
        if ( this.data.type === "script" ) {
            if ( !Macros.canUseScripts(game.user) )
                return ui.notifications.warn(`You are not allowed to use JavaScript macros.`);
            const asyncFunction = this.data.command.includes("await") ? "async" : "";
            return (new Function(`"use strict";
                return (${asyncFunction} function ({speaker, actor, token, character, args}={}) {
                    ${this.data.command}
                    });`))()(context);
        }
    }
    async executeMacro(...args) {
        if (!game.settings.get("furnace", "enableMacros"))
            return FurnacePatching.callOriginalFunction(this, "execute");

        // Chat macros
        if ( this.data.type === "chat" ) {
            try {
                const content = this.render(...args);
                ui.chat.processMessage(content).catch(err => {
                    ui.notifications.error("There was an error in your chat message syntax.");
                    console.error(err);
                });
            } catch (err) {
                ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
                console.error(err);
            }
        }

        // Script macros
        else if ( this.data.type === "script" ) {
            try {
                await this.render(...args);
            } catch (err) {
                ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
                console.error(err);
            }
        }
    }

    preCreateChatMessage(messages, data, options) {
        if (!game.settings.get("furnace", "enableMacros")) return;
        if (data.content === undefined || data.content.length == 0) return;

        let content = data.content || "";
        let tokenizer = null;
        let hasAsyncMacros = false;
        let hasMacros = false;
        if (content.includes("{{")) {
            const context = FurnaceMacros.getTemplateContext();
            const compiled = Handlebars.compile(content);
            content = compiled(context);
        }
        content = content.replace(/\n/gm, "<br>");
        content = content.split("<br>").map(line => {
            if (line.startsWith("/")) {
                // Ensure tokenizer, but don't consider dash as a token delimiter
                if (!tokenizer)
                    tokenizer = new TokenizeThis({
                        shouldTokenize: ['(', ')', ',', '*', '/', '%', '+', '=', '!=', '!', '<', '>', '<=', '>=', '^']
                    });
                let command = null;
                let args = [];
                tokenizer.tokenize(line.substr(1), (token) => {
                    if (!command) command = token;
                    else args.push(token);
                })
                const macro = game.macros.entities.find(macro => macro.name === command);
                if (macro) {
                    hasMacros = true;
                    const result = macro.render(...args);
                    if (result instanceof Promise) {
                        hasAsyncMacros = true;
                        return result;
                    }
                    if (typeof(result) !== "string")
                        return "";
                    return result;
                }
            }
            return line;
        });
        
        if (hasMacros) {
            mergeObject(data, { "flags.furnace.macros.template": data.content })
            // Macros were found; We need to await and cancel this message if async
            if (hasAsyncMacros) {
                Promise.all(content).then((lines) => {
                    data.content = lines.join("<br>");
                    if (data.content !== undefined && data.content.length > 0)
                        ChatMessage.create(data, options)
                }).catch (err => {
                    ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
                    console.error(err);
                });
                return false;
            } else {
                // If non-async, then still, recreate it so we can do recursive macro calls
                data.content = content.join("<br>");
                if (data.content !== undefined && data.content.length > 0)
                    ChatMessage.create(data, options)
                return false;
            }
        }
        data.content = content.join("<br>");
        return true;
    }
    renderMacroConfig(obj, html, data) {
        const form = html.find("form");
        const save = form.find("button[type=submit]");
        form.append($(`
        <div class="form-group">
            <button type="button" class="run-macro">
                <i class="fas fa-running"></i> Run Macro
            </button>
        </div>`))
        const run = form.find(".run-macro");
        run.bind('click', async (ev) => {
            const macro = obj.object;
            const origData = macro.data;
            const formData = obj._getFormData(form[0]);
            macro.data = Array.from(formData).reduce((obj, [k, v]) => {
                let dt = formData._dtypes[k];
                if ( dt === "Number" ) obj[k] = v !== "" ? Number(v) : null;
                else if ( dt === "Boolean" ) obj[k] = v === "true";
                else if ( dt === "Radio" ) obj[k] = JSON.parse(v);
                else obj[k] = v;
                return obj;
            }, {});
            await macro.execute();
            macro.data = origData;
        });
        save.insertBefore(run);
    }
}

new FurnaceMacros();