class FurnaceMacros {
    constructor() {
        let helpers = {
            now: () => new Date(),
            roll: (formula) => new Roll(formula).roll().total,
            multiply: (value1, value2) => Number(value1) * Number(value2),
            divide: (value1, value2) => Number(value1) / Number(value2)
        }
        H.registerHelpers(Handlebars)
        Handlebars.registerHelper(helpers)

        Hooks.on('init', this.init.bind(this));
    }

    init() {
        // Register module configuration settings
        game.settings.register("furnace", "enableMacros", {
            name: "Furnace: Enable Macros",
            hint: "Enable the parsing of the text chat as a Handlebars template acting as a macro system (experimental feature).",
            scope: "world",
            config: true,
            default: false,
            type: Boolean,
        });
        game.macros = this;
        Hooks.on('preCreateChatMessage', this.parseMessage.bind(this))
    }

    static getTemplateContext() {
        return { game: game, ui: ui, canvas: canvas }
    }

    parseMessage(message_class, data) {
        if (!game.settings.get("furnace", "enableMacros")) return;
        if (data.content === undefined || data.content.length == 0) return;

        let template = data.content || "";
        let command = template.match(`^/([^ !"#%&'\(\)\*+,\./;<=>@[\\]\^\`{\|}~\]\+)(.*)`);
        if (command !== null) {
            let macro = command[1]
            let macro_args = command[2]
            if (data.content.includes("\n")) {
                let content = data.content.split("\n").slice(1).join("\n")
                template = "{{#" + macro + " " + macro_args + "}}" + content + "{{/" + macro + "}}"
            } else {
                template = "{{" + macro + " " + macro_args + "}}"
            }
        }

        if (template.includes("{{") || template.includes("[[")) {
            console.log("Compiling Macro : ", template)
            let compiled = Handlebars.compile(template);
            let context = this.constructor.getTemplateContext()
            context["createData"] = data

            data.content = compiled(context)
            console.log("Result : ", data.content)
            mergeObject(data, { "flags.furnace.macros.template": template })
        }
        return data.content !== undefined && data.content.length > 0;
    }
}

new FurnaceMacros();