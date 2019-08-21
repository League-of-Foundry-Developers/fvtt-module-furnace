class FurnaceMacros {
    constructor() {
        let helpers = {
            now: () => new Date(),
            roll: (formula) => new Roll(formula).roll().total + ""
        }
        H.registerHelpers(Handlebars)
        for (let helper in helpers)
            Handlebars.registerHelper(helper, helpers[helper])
    }

    static getTemplateContext() {
        return {game: game, ui: ui, canvas: canvas}
    }
    
    parseMessage(message_class, data) {
        let template = data.content;
        let command = data.content.match(`^/([^ !"#%&'\(\)\*+,\./;<=>@[\\]\^\`{\|}~\]\+)(.*)`);
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
            let compiled = Handlebars.compile(template);
            let context = this.constructor.getTemplateContext()
            context["createData"] = data
            data.content = compiled(context)
            mergeObject(data, { "flags.furnace.macros.template": template })
        }
        
    }
}
game.macros = new FurnaceMacros()
Hooks.on('preCreateChatMessage', game.macros.parseMessage.bind(game.macros))