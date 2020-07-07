Hooks.on("hotbarDrop", (hotbar, data, slot) => {
    if (data.type !== "RollTable") return true;
    const table = game.tables.get(data.id);
    if (!table) return true;
    // Make a new macro for the RollTable
    Macro.create({
        name: `RollTable: ${table.name}`,
        type: "script",
        scope: "global",
        command: `game.tables.get("${table.id}").draw();`,
        img: "icons/svg/d20-grey.svg"
    }).then(macro => {
        game.user.assignHotbarMacro(macro, slot);
    });
    return false;
});