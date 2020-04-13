class FurnaceMacros {
    constructor() {
        let helpers = {
            macro: (name, ...args) => {
                const macro = game.macros.entities.find(macro => macro.name === name);
                if (!macro) return "";
                const result = macro.renderContent(...args);
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
        game.settings.register("furnace", "advancedMacros", {
            name: "Advanced Macros",
            hint: "Enable the ability to use async script macros, call macros with arguments, use Handlebars templating for chat macros and more. Check out the module website for more information.",
            scope: "world",
            config: true,
            default: true,
            type: Boolean,
        });
        game.macros = this;

        Hooks.on('preCreateChatMessage', this.preCreateChatMessage.bind(this))
        FurnacePatching.replaceMethod(Macro, "execute", this.executeMacro)
        Macro.prototype.renderContent = this.renderMacro;
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
        if (!game.settings.get("furnace", "advancedMacros"))
            return FurnacePatching.callOriginalFunction(this, "execute");

        // Chat macros
        if ( this.data.type === "chat" ) {
            try {
                const content = this.renderContent(...args);
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
                await this.renderContent(...args);
            } catch (err) {
                ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
                console.error(err);
            }
        }
    }

    preCreateChatMessage(data, options, userId) {
        if (!game.settings.get("furnace", "advancedMacros")) return;
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
        if (content.trim().startsWith("<")) return true;
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
                    const result = macro.renderContent(...args);
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

    _highlightMacroCode(form, textarea, code) {
        const type = form.find("select[name=type]").val();
        let content = textarea.val();
        // Add an empty space if the last character is a newline because otherwise it won't let scrollTop reach
        // so we get a one line diff between the text area and <pre> when the last line is empty.
        if (content.substr(-1) === "\n") content += " ";
        code.removeClass("javascript handlebars hljs").addClass(type === "script" ? "javascript" : "handlebars");
        code.text(content);
        hljs.highlightBlock(code[0]);
    }
    renderMacroConfig(obj, html, data) {
        const form = html.find("form");
        // Add syntax highlighting

        const textarea = form.find("textarea");
        const div = $(`
        <div class="furnace-macro-command form-group">
            <pre><code class="furnace-macro-syntax-highlight"></code></pre>
            <div class="furnace-macro-expand"><i class="fas fa-expand-alt"></i></div>
        </div>
        `)
        const code = div.find("code");
        div.insertBefore(textarea);
        div.prepend(textarea);
        const refreshHighlight = this._highlightMacroCode.bind(this, form, textarea, code);
        textarea.on('input', refreshHighlight);
        textarea.on('scroll', (ev) => code.parent().scrollTop(textarea.scrollTop()));
        form.find("select[name=type]").on('change', refreshHighlight);
        div.find(".furnace-macro-expand").on('click', (ev) => div.toggleClass("fullscreen"));
        refreshHighlight();
    }
}

new FurnaceMacros();