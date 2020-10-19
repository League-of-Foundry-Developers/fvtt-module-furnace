class FurnaceCombatQoL {
    static renderCombatTracker(tracker, html, data) {
        if (!game.user.isGM) return;
        html.find(".token-initiative").off("dblclick").on("dblclick", FurnaceCombatQoL._onInitiativeDblClick)
        for (let combatant of html.find("#combat-tracker li.combatant")) {
            if (combatant.classList.contains("active"))
                break;
            combatant.classList.add("turn-done");
        }
    }
    static _onInitiativeDblClick(event) {
        event.stopPropagation();
        event.preventDefault();
        let html = $(event.target).closest(".combatant")
        let cid = html.data("combatant-id")
        let initiative = html.find(".token-initiative")
        let combatant = game.combat.getCombatant(cid)
        let input = $(`<input class="initiative" style="width: 90%" value="${combatant.initiative}"/>`)
        initiative.off("dblclick")
        initiative.empty().append(input)
        input.focus().select()
        input.on('change', ev => game.combat.updateCombatant({ _id: cid, initiative: input.val() }))
        input.on('focusout', ev => game.combats.render())


    }
}

Hooks.on('renderCombatTracker', FurnaceCombatQoL.renderCombatTracker)