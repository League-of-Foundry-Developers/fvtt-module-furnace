class FurnaceCombatQoL {
    static renderCombatTracker(tracker, html, data) {
        if (!game.user.isGM) return;
        html.find(".token-initiative").off("dblclick").on("dblclick", FurnaceCombatQoL._onInitiativeDblClick)
    }
    static _onInitiativeDblClick(event) {
        let html = $(event.target).closest(".combatant")
        let cid = html.data("combatant-id")
        let initiative = html.find(".token-initiative")
        let combatant = game.combat.getCombatant(cid)
        let input = $(`<input class="initiative" style="width: 90%" value="${combatant.initiative}"/>`)
        initiative.off("dblclick")
        initiative.empty().append(input)
        input.focus()
        input.select()
        input.on('change', ev => game.combat.updateCombatant({ id: cid, initiative: input.val() }))
        input.on('focusout', ev => game.combats.render())


    }/*
        <div class="token-initiative">
                <span class="initiative">15.13</span>
            </div>
    }*/
}

Hooks.on('renderCombatTracker', FurnaceCombatQoL.renderCombatTracker)